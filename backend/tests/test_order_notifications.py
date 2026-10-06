"""Backend tests for order lifecycle notifications & Web Push API."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://medilo-pharmacy.preview.emergentagent.com").rstrip("/")

CUSTOMER_PHONE = "9876543210"
PHARMACIST = {"email": "pharmacist@medilo.com", "password": "test123"}
PHARMACY_STAFF = {"email": "pharmacy_staff@test.com", "password": "test123"}
DELIVERY_PHONE = "9988776655"

OTC_MEDICINE_ID = "e2b792b9-13e8-4d1a-ba3c-21b75a959c85"  # Dolo 650


def _login_customer():
    r = requests.post(f"{BASE_URL}/api/auth/customer/login", json={"phone": CUSTOMER_PHONE})
    r.raise_for_status()
    return r.json()["access_token"], r.json()["user"]["id"]


def _login_staff(creds):
    r = requests.post(f"{BASE_URL}/api/auth/staff/login", json=creds)
    r.raise_for_status()
    return r.json()["access_token"], r.json()["user"]


def _login_delivery():
    r = requests.post(f"{BASE_URL}/api/auth/delivery/login", json={"phone": DELIVERY_PHONE})
    r.raise_for_status()
    return r.json()["access_token"], r.json()["user"]["id"]


def _hdr(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def customer_auth():
    return _login_customer()


@pytest.fixture(scope="module")
def pharmacist_auth():
    return _login_staff(PHARMACIST)


@pytest.fixture(scope="module")
def pharmacy_staff_auth():
    return _login_staff(PHARMACY_STAFF)


@pytest.fixture(scope="module")
def delivery_auth():
    return _login_delivery()


def _get_notifs(customer_token):
    r = requests.get(f"{BASE_URL}/api/customer/notifications", headers=_hdr(customer_token))
    assert r.status_code == 200, r.text
    return r.json()


def _latest_for_order(notifs, order_id):
    return [n for n in notifs if n.get("order_id") == order_id]


# ======== Web Push API ========
class TestWebPushAPI:
    def test_vapid_public_key(self, customer_auth):
        token, _ = customer_auth
        r = requests.get(f"{BASE_URL}/api/push/vapid-public-key", headers=_hdr(token))
        assert r.status_code == 200
        key = r.json().get("public_key")
        assert isinstance(key, str) and len(key) > 20

    def test_subscribe_idempotent_and_unsubscribe(self, customer_auth):
        token, _ = customer_auth
        sub = {
            "endpoint": f"https://fcm.googleapis.com/fcm/send/TEST_{int(time.time())}",
            "keys": {"p256dh": "BPTEST_p256dh_key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", "auth": "TEST_auth_xxxxxxxxxxxxxxxxx"}
        }
        r1 = requests.post(f"{BASE_URL}/api/push/subscribe", headers=_hdr(token), json=sub)
        assert r1.status_code == 200, r1.text
        r2 = requests.post(f"{BASE_URL}/api/push/subscribe", headers=_hdr(token), json=sub)
        assert r2.status_code == 200
        # unsubscribe
        r3 = requests.post(f"{BASE_URL}/api/push/unsubscribe", headers=_hdr(token), json={"endpoint": sub["endpoint"]})
        assert r3.status_code == 200

    def test_subscribe_rejects_non_customer(self, pharmacist_auth):
        token, _ = pharmacist_auth
        sub = {"endpoint": "https://fcm.googleapis.com/fcm/send/TEST_denied", "keys": {"p256dh": "x", "auth": "y"}}
        r = requests.post(f"{BASE_URL}/api/push/subscribe", headers=_hdr(token), json=sub)
        assert r.status_code == 403

    def test_subscribe_requires_endpoint(self, customer_auth):
        token, _ = customer_auth
        r = requests.post(f"{BASE_URL}/api/push/subscribe", headers=_hdr(token), json={"keys": {}})
        assert r.status_code == 400


# ======== Full lifecycle (OTC path, no pharmacist review) ========
class TestOrderLifecycleNotifications:
    @pytest.fixture(scope="class")
    def lifecycle(self, customer_auth, pharmacist_auth, pharmacy_staff_auth, delivery_auth):
        c_tok, c_id = customer_auth
        ph_tok, ph_user = pharmacist_auth
        ps_tok, ps_user = pharmacy_staff_auth
        d_tok, d_id = delivery_auth
        pharmacy_id = ps_user["pharmacy_id"]
        assert pharmacy_id, "pharmacy_staff must have pharmacy_id"

        # Baseline notification count
        pre = _get_notifs(c_tok)
        pre_count = len(pre)

        # 1. Place OTC order -> initial status = pharmacist_approved
        payload = {
            "items": [{"medicine_id": OTC_MEDICINE_ID, "quantity": 1}],
            "delivery_address": "TEST_ADDR 123, City",
            "latitude": 12.9,
            "longitude": 77.6,
        }
        r = requests.post(f"{BASE_URL}/api/orders", headers=_hdr(c_tok), json=payload)
        assert r.status_code == 200, r.text
        order = r.json()
        order_id = order["id"]
        assert order["status"] == "pharmacist_approved"

        results = {"order_id": order_id, "customer_token": c_tok, "transitions": []}

        def check_notification(expected_status, expected_type, title_contains=None):
            # small wait for async notification creation
            time.sleep(0.5)
            notifs = _get_notifs(c_tok)
            order_notifs = _latest_for_order(notifs, order_id)
            # most recent first
            latest = order_notifs[0] if order_notifs else None
            assert latest is not None, f"No notification for {expected_status}"
            assert latest["type"] == expected_type, f"Expected type {expected_type}, got {latest['type']} for {expected_status}"
            assert order_id[:8].upper() in latest["message"], f"order id not referenced in message: {latest['message']}"
            if title_contains:
                assert title_contains.lower() in latest["title"].lower(), f"title '{latest['title']}' missing '{title_contains}'"
            results["transitions"].append((expected_status, latest["title"], latest["type"]))
            return latest

        # Initial notification (pharmacist_approved)
        check_notification("pharmacist_approved", "order_update", "approved")

        # 2. Pharmacist assigns pharmacy
        r = requests.post(
            f"{BASE_URL}/api/pharmacist/orders/{order_id}/assign",
            headers=_hdr(ph_tok),
            params={"pharmacy_id": pharmacy_id},
        )
        assert r.status_code == 200, r.text
        check_notification("assigned_to_pharmacy", "order_update", "Pharmacy assigned")

        # 3. Pharmacy accept
        r = requests.post(
            f"{BASE_URL}/api/pharmacy/orders/{order_id}/action",
            headers=_hdr(ps_tok),
            json={"action": "accept"},
        )
        assert r.status_code == 200, r.text
        check_notification("pharmacy_accepted", "order_update", "accepted")

        # 4. Confirm inventory
        r = requests.post(
            f"{BASE_URL}/api/pharmacy/orders/{order_id}/confirm-inventory",
            headers=_hdr(ps_tok),
            json={"items": [{"medicine_id": OTC_MEDICINE_ID, "batch_number": "TESTBATCH", "expiry_date": "2027-01-01"}]},
        )
        assert r.status_code == 200, r.text
        check_notification("inventory_confirmed", "order_update", "confirmed")

        # 5. Preparing
        r = requests.post(
            f"{BASE_URL}/api/pharmacy/orders/{order_id}/action",
            headers=_hdr(ps_tok),
            json={"action": "mark_preparing"},
        )
        assert r.status_code == 200, r.text
        check_notification("preparing", "order_update", "Preparing")

        # 6. Ready
        r = requests.post(
            f"{BASE_URL}/api/pharmacy/orders/{order_id}/action",
            headers=_hdr(ps_tok),
            json={"action": "mark_ready"},
        )
        assert r.status_code == 200, r.text
        check_notification("ready_for_pickup", "order_update", "Ready")

        # 7. Delivery accept -> picked_up
        r = requests.post(f"{BASE_URL}/api/delivery/orders/{order_id}/accept", headers=_hdr(d_tok))
        assert r.status_code == 200, r.text
        check_notification("picked_up", "delivery_update", "picked up")

        # 8. Out for delivery
        r = requests.post(
            f"{BASE_URL}/api/delivery/orders/{order_id}/action",
            headers=_hdr(d_tok),
            json={"action": "out_for_delivery"},
        )
        assert r.status_code == 200, r.text
        check_notification("out_for_delivery", "delivery_update", "Out for delivery")

        # 9. Delivered
        r = requests.post(
            f"{BASE_URL}/api/delivery/orders/{order_id}/action",
            headers=_hdr(d_tok),
            json={"action": "delivered"},
        )
        assert r.status_code == 200, r.text
        check_notification("delivered", "delivery_update", "Delivered")

        # Final count: should have 9 new notifications
        post = _get_notifs(c_tok)
        new_notifs = [n for n in post if n.get("order_id") == order_id]
        assert len(new_notifs) == 9, f"Expected 9 notifs for order, got {len(new_notifs)}: {[n['title'] for n in new_notifs]}"
        results["final_count"] = len(new_notifs)
        results["pre_count"] = pre_count
        return results

    def test_lifecycle_produces_all_notifications(self, lifecycle):
        assert lifecycle["final_count"] == 9
        titles = [t[1] for t in lifecycle["transitions"]]
        print("Lifecycle titles:", titles)

    def test_delivery_stage_types(self, lifecycle):
        delivery_stages = [t for t in lifecycle["transitions"] if t[0] in ("picked_up", "out_for_delivery", "delivered")]
        for status, title, ntype in delivery_stages:
            assert ntype == "delivery_update", f"{status} should be delivery_update, got {ntype}"

    def test_non_delivery_stage_types(self, lifecycle):
        other_stages = [t for t in lifecycle["transitions"] if t[0] not in ("picked_up", "out_for_delivery", "delivered")]
        for status, title, ntype in other_stages:
            assert ntype == "order_update", f"{status} should be order_update, got {ntype}"

    def test_order_id_present_in_notifications(self, lifecycle):
        token = lifecycle["customer_token"]
        notifs = _get_notifs(token)
        order_notifs = _latest_for_order(notifs, lifecycle["order_id"])
        for n in order_notifs:
            assert n.get("order_id") == lifecycle["order_id"]


# ======== Cancel path ========
class TestCancelNotification:
    def test_cancel_creates_notification(self, customer_auth):
        c_tok, _ = customer_auth
        # place a fresh order
        payload = {
            "items": [{"medicine_id": OTC_MEDICINE_ID, "quantity": 1}],
            "delivery_address": "TEST_CANCEL_ADDR",
            "latitude": 12.9,
            "longitude": 77.6,
        }
        r = requests.post(f"{BASE_URL}/api/orders", headers=_hdr(c_tok), json=payload)
        assert r.status_code == 200, r.text
        order_id = r.json()["id"]

        r = requests.post(f"{BASE_URL}/api/orders/{order_id}/cancel", headers=_hdr(c_tok))
        assert r.status_code == 200, r.text

        time.sleep(0.5)
        notifs = _get_notifs(c_tok)
        order_notifs = _latest_for_order(notifs, order_id)
        titles = [n["title"] for n in order_notifs]
        assert any("cancel" in t.lower() for t in titles), f"No cancel notification found: {titles}"
        cancel_notif = next(n for n in order_notifs if "cancel" in n["title"].lower())
        assert cancel_notif["type"] == "order_update"
        assert order_id[:8].upper() in cancel_notif["message"]
