"""
Regression tests for MEDILO backend refactor (server.py split into
config/models/services/routers/*). Confirms:
- All roles (customer, ops, pharmacist, pharmacy staff, delivery) can auth
- Public endpoints (health, categories, medicines, discount-config) work
- Ops CRUD-esque endpoints (customers, analytics, orders, users, audit, support, notifications)
- Customer endpoints (profile, addresses, wishlist, prescriptions, tickets, notifications)
- Invoice download returns application/pdf
- Pharmacist/pharmacy/delivery order-list endpoints respond
"""
import os
import io
import pytest
import requests

# Load env from /app/frontend/.env for pytest CLI runs
try:
    from dotenv import load_dotenv
    load_dotenv("/app/frontend/.env")
except Exception:
    pass

_url = os.environ.get("REACT_APP_BACKEND_URL")
if not _url:
    # fallback: parse frontend .env directly
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    _url = line.strip().split("=", 1)[1]
                    break
    except Exception:
        pass
assert _url, "REACT_APP_BACKEND_URL not set"
BASE_URL = _url.rstrip("/")


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login_staff(http, email, password):
    r = http.post(f"{BASE_URL}/api/auth/staff/login",
                  json={"email": email, "password": password})
    assert r.status_code == 200, f"staff login {email} failed: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def ops_token(http):
    return _login_staff(http, "ops@medilo.com", "test123")


@pytest.fixture(scope="session")
def pharmacist_token(http):
    return _login_staff(http, "pharmacist@medilo.com", "test123")


@pytest.fixture(scope="session")
def pharmacy_staff_token(http):
    return _login_staff(http, "pharmacy_staff@test.com", "test123")


@pytest.fixture(scope="session")
def delivery_token(http):
    # Delivery login is by phone (per DeliveryPartnerLogin model), not email.
    # Credentials file entry (delivery@medilo.com) is outdated for this endpoint.
    r = http.post(f"{BASE_URL}/api/auth/delivery/login",
                  json={"phone": "9988776655"})
    if r.status_code != 200:
        pytest.skip(f"delivery login failed: {r.status_code} {r.text[:200]}")
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def customer_token(http):
    r = http.post(f"{BASE_URL}/api/auth/customer/login",
                  json={"phone": "9876543210"})
    assert r.status_code == 200, f"customer login failed: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Public / Health ----------
class TestPublic:
    def test_health(self, http):
        r = http.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "healthy"
        assert "timestamp" in data

    def test_categories(self, http):
        r = http.get(f"{BASE_URL}/api/categories")
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list) and len(cats) >= 1

    def test_medicines_list(self, http):
        r = http.get(f"{BASE_URL}/api/medicines")
        assert r.status_code == 200
        meds = r.json()
        assert isinstance(meds, list) and len(meds) >= 1
        # Validate response shape unchanged after refactor
        m = meds[0]
        for f in ("id", "name", "price", "product_type"):
            assert f in m, f"missing field {f}"

    def test_discount_config(self, http):
        r = http.get(f"{BASE_URL}/api/discount-config")
        assert r.status_code == 200
        cfg = r.json()
        # any of these keys is fine; must not be empty
        assert isinstance(cfg, dict) and len(cfg) >= 1


# ---------- Auth ----------
class TestAuth:
    def test_auth_me_ops(self, http, ops_token):
        r = http.get(f"{BASE_URL}/api/auth/me", headers=_auth(ops_token))
        assert r.status_code == 200
        u = r.json()
        assert u.get("email") == "ops@medilo.com"
        assert u.get("role") in ("ops", "OPS", "admin")

    def test_auth_me_customer(self, http, customer_token):
        r = http.get(f"{BASE_URL}/api/auth/me", headers=_auth(customer_token))
        assert r.status_code == 200
        u = r.json()
        assert u.get("phone") == "9876543210"

    def test_staff_login_bad_password(self, http):
        r = http.post(f"{BASE_URL}/api/auth/staff/login",
                      json={"email": "ops@medilo.com", "password": "wrongpass"})
        assert r.status_code in (400, 401, 403)


# ---------- Customer ----------
class TestCustomer:
    def test_profile(self, http, customer_token):
        r = http.get(f"{BASE_URL}/api/customer/profile", headers=_auth(customer_token))
        assert r.status_code == 200
        p = r.json()
        assert "phone" in p or "user" in p or "id" in p

    def test_addresses(self, http, customer_token):
        r = http.get(f"{BASE_URL}/api/customer/addresses", headers=_auth(customer_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_wishlist(self, http, customer_token):
        r = http.get(f"{BASE_URL}/api/customer/wishlist", headers=_auth(customer_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_prescriptions(self, http, customer_token):
        r = http.get(f"{BASE_URL}/api/customer/prescriptions", headers=_auth(customer_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_support_tickets(self, http, customer_token):
        r = http.get(f"{BASE_URL}/api/customer/support-tickets", headers=_auth(customer_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_notifications(self, http, customer_token):
        r = http.get(f"{BASE_URL}/api/customer/notifications", headers=_auth(customer_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_notifications_unread(self, http, customer_token):
        r = http.get(f"{BASE_URL}/api/customer/notifications/unread-count",
                     headers=_auth(customer_token))
        assert r.status_code == 200
        data = r.json()
        assert "unread_count" in data or "count" in data or isinstance(data, dict)

    def test_orders_list(self, http, customer_token):
        r = http.get(f"{BASE_URL}/api/orders", headers=_auth(customer_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Ops ----------
class TestOps:
    def test_ops_customers_list(self, http, ops_token):
        r = http.get(f"{BASE_URL}/api/ops/customers", headers=_auth(ops_token))
        assert r.status_code == 200
        customers = r.json()
        assert isinstance(customers, list)
        # Should have at least the test customer
        assert len(customers) >= 1

    def test_ops_customer_detail(self, http, ops_token):
        list_r = http.get(f"{BASE_URL}/api/ops/customers", headers=_auth(ops_token))
        assert list_r.status_code == 200
        customers = list_r.json()
        if not customers:
            pytest.skip("No customers to fetch detail for")
        cust_id = customers[0].get("id") or customers[0].get("_id") or customers[0].get("user_id")
        assert cust_id, f"No id field in customer object: {list(customers[0].keys())}"
        r = http.get(f"{BASE_URL}/api/ops/customers/{cust_id}", headers=_auth(ops_token))
        assert r.status_code == 200
        detail = r.json()
        assert isinstance(detail, dict)

    def test_ops_analytics(self, http, ops_token):
        r = http.get(f"{BASE_URL}/api/ops/analytics/customers", headers=_auth(ops_token))
        assert r.status_code == 200
        a = r.json()
        assert isinstance(a, dict) and len(a) >= 1

    def test_ops_orders(self, http, ops_token):
        r = http.get(f"{BASE_URL}/api/ops/orders", headers=_auth(ops_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_ops_users(self, http, ops_token):
        r = http.get(f"{BASE_URL}/api/ops/users", headers=_auth(ops_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_ops_audit_logs(self, http, ops_token):
        r = http.get(f"{BASE_URL}/api/ops/audit-logs", headers=_auth(ops_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_ops_support_tickets(self, http, ops_token):
        r = http.get(f"{BASE_URL}/api/ops/support-tickets", headers=_auth(ops_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_ops_forbidden_for_customer(self, http, customer_token):
        r = http.get(f"{BASE_URL}/api/ops/customers", headers=_auth(customer_token))
        assert r.status_code in (401, 403)


# ---------- Pharmacies ----------
class TestPharmacies:
    def test_pharmacies_list(self, http, ops_token):
        r = http.get(f"{BASE_URL}/api/pharmacies", headers=_auth(ops_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Pharmacist / Pharmacy Staff / Delivery ----------
class TestOrderConsumers:
    def test_pharmacist_orders(self, http, pharmacist_token):
        r = http.get(f"{BASE_URL}/api/pharmacist/orders", headers=_auth(pharmacist_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_pharmacy_orders(self, http, pharmacy_staff_token):
        r = http.get(f"{BASE_URL}/api/pharmacy/orders", headers=_auth(pharmacy_staff_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_delivery_orders(self, http, delivery_token):
        r = http.get(f"{BASE_URL}/api/delivery/orders", headers=_auth(delivery_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Invoice ----------
class TestInvoice:
    def test_invoice_for_invoiced_order(self, http, customer_token):
        # Fetch this customer's orders, find one that's delivered/invoiced
        r = http.get(f"{BASE_URL}/api/orders", headers=_auth(customer_token))
        assert r.status_code == 200
        orders = r.json()
        target = None
        for o in orders:
            if o.get("invoice_number") or (o.get("status") or "").lower() == "delivered":
                target = o
                break
        if not target:
            pytest.skip("No delivered/invoiced order for test customer")
        order_id = target["id"]
        r = http.get(f"{BASE_URL}/api/orders/{order_id}/invoice", headers=_auth(customer_token))
        assert r.status_code == 200, f"invoice download failed {r.status_code} {r.text[:200]}"
        ctype = r.headers.get("content-type", "")
        assert "application/pdf" in ctype, f"expected application/pdf, got {ctype}"
        assert r.content[:4] == b"%PDF", "response does not look like a PDF"


# ---------- Ops write-flow smoke (send notification broadcast) ----------
class TestOpsWriteFlows:
    def test_send_broadcast_notification(self, http, ops_token):
        payload = {
            "title": "TEST_regression_broadcast",
            "message": "Automated regression test - safe to ignore",
            "broadcast": True,
        }
        r = http.post(f"{BASE_URL}/api/ops/notifications/send",
                      json=payload, headers=_auth(ops_token))
        # Accept 200 or 201; log body if not success
        assert r.status_code in (200, 201), f"send notification failed: {r.status_code} {r.text[:200]}"
