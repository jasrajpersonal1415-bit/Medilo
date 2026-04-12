"""
Test suite for MEDILO Discount System
- Category discounts: Medicine 10%, Baby Care 20%, Wellness 12%, Beauty & Personal Care 8%, Device 0%
- Cart-level discounts: ≥₹2000 medicine subtotal → 5%, ≥₹3000 → 10%
- Cart discount applies ONLY on medicine subtotal after category discount
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def customer_token():
    """Login as customer to create orders"""
    response = requests.post(f"{BASE_URL}/api/auth/customer/login", json={"phone": "9876543210"})
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Customer login failed")

@pytest.fixture(scope="module")
def ops_token():
    """Login as ops to manage products"""
    response = requests.post(f"{BASE_URL}/api/auth/staff/login", json={
        "email": "ops@medilo.com",
        "password": "test123"
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Ops login failed")

@pytest.fixture(scope="module")
def test_products(ops_token):
    """Get or create test products for each category"""
    headers = {"Authorization": f"Bearer {ops_token}"}
    products = {}
    
    # Get existing products by category
    categories = ["Medicine", "Baby Care", "Wellness", "Beauty & Personal Care", "Device"]
    for cat in categories:
        response = requests.get(f"{BASE_URL}/api/medicines", params={"product_type": cat})
        if response.status_code == 200:
            items = response.json()
            if items:
                products[cat] = items[0]
    
    # Create test products if missing
    if "Medicine" not in products:
        resp = requests.post(f"{BASE_URL}/api/medicines", headers=headers, json={
            "name": "TEST_Discount_Medicine",
            "generic_name": "Test Generic",
            "manufacturer": "Test Pharma",
            "bucket": "OTC",
            "form": "tablet",
            "pack_size": "10 tablets",
            "price": 100.0,
            "product_type": "Medicine"
        })
        if resp.status_code == 200:
            products["Medicine"] = resp.json()
    
    if "Baby Care" not in products:
        resp = requests.post(f"{BASE_URL}/api/medicines", headers=headers, json={
            "name": "TEST_Discount_BabyCare",
            "generic_name": "Baby Product",
            "manufacturer": "Baby Corp",
            "form": "cream",
            "pack_size": "50g",
            "price": 200.0,
            "product_type": "Baby Care"
        })
        if resp.status_code == 200:
            products["Baby Care"] = resp.json()
    
    if "Wellness" not in products:
        resp = requests.post(f"{BASE_URL}/api/medicines", headers=headers, json={
            "name": "TEST_Discount_Wellness",
            "generic_name": "Wellness Product",
            "manufacturer": "Wellness Corp",
            "form": "capsule",
            "pack_size": "30 capsules",
            "price": 150.0,
            "product_type": "Wellness"
        })
        if resp.status_code == 200:
            products["Wellness"] = resp.json()
    
    return products


class TestDiscountConfig:
    """Test GET /api/discount-config endpoint"""
    
    def test_discount_config_returns_correct_category_discounts(self):
        """Verify category_discounts has correct rates"""
        response = requests.get(f"{BASE_URL}/api/discount-config")
        assert response.status_code == 200
        
        data = response.json()
        assert "category_discounts" in data
        
        cat_discounts = data["category_discounts"]
        assert cat_discounts["Medicine"] == 0.10, "Medicine should be 10%"
        assert cat_discounts["Baby Care"] == 0.20, "Baby Care should be 20%"
        assert cat_discounts["Wellness"] == 0.12, "Wellness should be 12%"
        assert cat_discounts["Beauty & Personal Care"] == 0.08, "Beauty & Personal Care should be 8%"
        assert cat_discounts["Device"] == 0.0, "Device should be 0%"
        print("✓ Category discounts are correct")
    
    def test_discount_config_returns_correct_cart_tiers(self):
        """Verify cart_discount_tiers has correct thresholds and rates"""
        response = requests.get(f"{BASE_URL}/api/discount-config")
        assert response.status_code == 200
        
        data = response.json()
        assert "cart_discount_tiers" in data
        
        tiers = data["cart_discount_tiers"]
        assert len(tiers) == 2, "Should have 2 cart discount tiers"
        
        # First tier: ≥₹3000 → 10%
        assert tiers[0]["threshold"] == 3000
        assert tiers[0]["rate"] == 0.10
        
        # Second tier: ≥₹2000 → 5%
        assert tiers[1]["threshold"] == 2000
        assert tiers[1]["rate"] == 0.05
        
        print("✓ Cart discount tiers are correct")


def approx_equal(a, b, tolerance=0.01):
    """Compare floats with tolerance for rounding differences"""
    return abs(a - b) < tolerance


class TestOrderDiscountCalculation:
    """Test POST /api/orders with discount calculations"""
    
    def test_medicine_category_discount_10_percent(self, customer_token, test_products):
        """Medicine items should get 10% category discount"""
        if "Medicine" not in test_products:
            pytest.skip("No Medicine product available")
        
        headers = {"Authorization": f"Bearer {customer_token}"}
        medicine = test_products["Medicine"]
        
        # Order 10 units of medicine
        order_data = {
            "items": [{"medicine_id": medicine["id"], "quantity": 10}],
            "delivery_address": "Test Address for Discount Testing",
            "latitude": 12.9716,
            "longitude": 77.5946
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", headers=headers, json=order_data)
        assert response.status_code == 200
        
        order = response.json()
        expected_subtotal = medicine["price"] * 10
        expected_cat_discount = expected_subtotal * 0.10
        expected_total = expected_subtotal - expected_cat_discount
        
        assert approx_equal(order["subtotal"], expected_subtotal), f"Subtotal should be {expected_subtotal}"
        assert approx_equal(order["category_discount"], expected_cat_discount), f"Category discount should be {expected_cat_discount}"
        # Cart discount may be 0 or positive depending on medicine price
        assert order["cart_discount"] >= 0, "Cart discount should be >= 0"
        assert approx_equal(order["total_savings"], order["category_discount"] + order["cart_discount"])
        
        print(f"✓ Medicine 10% discount: Subtotal={order['subtotal']}, Discount={order['category_discount']}, Total={order['total_amount']}")
    
    def test_baby_care_category_discount_20_percent(self, customer_token, test_products):
        """Baby Care items should get 20% category discount"""
        if "Baby Care" not in test_products:
            pytest.skip("No Baby Care product available")
        
        headers = {"Authorization": f"Bearer {customer_token}"}
        baby_care = test_products["Baby Care"]
        
        order_data = {
            "items": [{"medicine_id": baby_care["id"], "quantity": 5}],
            "delivery_address": "Test Address for Baby Care Discount",
            "latitude": 12.9716,
            "longitude": 77.5946
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", headers=headers, json=order_data)
        assert response.status_code == 200
        
        order = response.json()
        expected_subtotal = baby_care["price"] * 5
        expected_cat_discount = expected_subtotal * 0.20  # 20% for Baby Care
        expected_total = expected_subtotal - expected_cat_discount
        
        assert order["subtotal"] == expected_subtotal
        assert order["category_discount"] == expected_cat_discount, f"Baby Care should get 20% discount"
        assert order["cart_discount"] == 0, "Cart discount only applies to Medicine"
        assert order["total_amount"] == expected_total
        
        print(f"✓ Baby Care 20% discount: Subtotal={order['subtotal']}, Discount={order['category_discount']}, Total={order['total_amount']}")
    
    def test_cart_discount_5_percent_at_2000(self, customer_token, test_products):
        """Cart discount 5% triggers at ₹2000 medicine subtotal (after category discount)"""
        if "Medicine" not in test_products:
            pytest.skip("No Medicine product available")
        
        headers = {"Authorization": f"Bearer {customer_token}"}
        medicine = test_products["Medicine"]
        
        # Calculate qty needed for medicine subtotal after 10% discount to be between ₹2000 and ₹3000
        # Need: 2000 <= price * qty * 0.90 < 3000
        price = medicine["price"]
        min_qty = int(2000 / (price * 0.90)) + 1
        max_qty = int(3000 / (price * 0.90))
        qty = min(min_qty, max_qty) if min_qty <= max_qty else min_qty
        
        order_data = {
            "items": [{"medicine_id": medicine["id"], "quantity": qty}],
            "delivery_address": "Test Address for Cart Discount 5%",
            "latitude": 12.9716,
            "longitude": 77.5946
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", headers=headers, json=order_data)
        assert response.status_code == 200
        
        order = response.json()
        subtotal = price * qty
        cat_discount = subtotal * 0.10
        medicine_after_cat = subtotal - cat_discount
        
        assert approx_equal(order["subtotal"], subtotal)
        assert approx_equal(order["category_discount"], cat_discount)
        
        # Check cart discount based on actual medicine_after_cat
        if medicine_after_cat >= 3000:
            expected_rate = 0.10
        elif medicine_after_cat >= 2000:
            expected_rate = 0.05
        else:
            expected_rate = 0
        
        expected_cart_discount = medicine_after_cat * expected_rate
        assert approx_equal(order["cart_discount"], expected_cart_discount), f"Cart discount should be {expected_rate*100}% of {medicine_after_cat}"
        
        print(f"✓ Cart discount at ₹{medicine_after_cat:.0f}: rate={expected_rate*100}%, cart_discount={order['cart_discount']}")
    
    def test_cart_discount_10_percent_at_3000(self, customer_token, test_products):
        """Cart discount 10% triggers at ₹3000 medicine subtotal (after category discount)"""
        if "Medicine" not in test_products:
            pytest.skip("No Medicine product available")
        
        headers = {"Authorization": f"Bearer {customer_token}"}
        medicine = test_products["Medicine"]
        
        # Calculate qty needed for medicine subtotal after 10% discount >= ₹3000
        price = medicine["price"]
        qty = int(3000 / (price * 0.90)) + 1
        
        order_data = {
            "items": [{"medicine_id": medicine["id"], "quantity": qty}],
            "delivery_address": "Test Address for Cart Discount 10%",
            "latitude": 12.9716,
            "longitude": 77.5946
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", headers=headers, json=order_data)
        assert response.status_code == 200
        
        order = response.json()
        subtotal = price * qty
        cat_discount = subtotal * 0.10
        medicine_after_cat = subtotal - cat_discount
        
        # Cart discount should be 10% of medicine_after_cat (since >= 3000)
        expected_cart_discount = medicine_after_cat * 0.10
        
        assert approx_equal(order["subtotal"], subtotal)
        assert approx_equal(order["category_discount"], cat_discount)
        assert medicine_after_cat >= 3000, f"Medicine after cat should be >= 3000, got {medicine_after_cat}"
        assert approx_equal(order["cart_discount"], expected_cart_discount), f"Cart discount should be 10% of {medicine_after_cat}"
        
        print(f"✓ Cart discount 10% at ₹3000: Medicine after cat discount={medicine_after_cat}, Cart discount={order['cart_discount']}")
    
    def test_cart_discount_only_on_medicine_not_other_categories(self, customer_token, test_products):
        """Cart discount should NOT apply to non-medicine categories even if total is high"""
        if "Baby Care" not in test_products:
            pytest.skip("No Baby Care product available")
        
        headers = {"Authorization": f"Bearer {customer_token}"}
        baby_care = test_products["Baby Care"]
        
        # Order large qty of Baby Care to exceed ₹3000 subtotal
        # But cart discount should still be 0 since it's not Medicine
        qty = 20  # 20 * 200 = ₹4000 subtotal
        
        order_data = {
            "items": [{"medicine_id": baby_care["id"], "quantity": qty}],
            "delivery_address": "Test Address for Non-Medicine Cart Discount",
            "latitude": 12.9716,
            "longitude": 77.5946
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", headers=headers, json=order_data)
        assert response.status_code == 200
        
        order = response.json()
        
        # Cart discount should be 0 because Baby Care is not Medicine
        assert order["cart_discount"] == 0, "Cart discount should NOT apply to Baby Care"
        assert order["category_discount"] > 0, "Category discount should apply (20% for Baby Care)"
        
        print(f"✓ Cart discount correctly NOT applied to Baby Care: cart_discount={order['cart_discount']}")
    
    def test_mixed_cart_discount_only_on_medicine_portion(self, customer_token, test_products):
        """Mixed cart: cart discount applies only to medicine subtotal, not other categories"""
        if "Medicine" not in test_products or "Baby Care" not in test_products:
            pytest.skip("Need both Medicine and Baby Care products")
        
        headers = {"Authorization": f"Bearer {customer_token}"}
        medicine = test_products["Medicine"]
        baby_care = test_products["Baby Care"]
        
        # Calculate qty needed for medicine subtotal after 10% discount >= ₹3000
        med_price = medicine["price"]
        med_qty = int(3000 / (med_price * 0.90)) + 1
        baby_qty = 2
        
        order_data = {
            "items": [
                {"medicine_id": medicine["id"], "quantity": med_qty},
                {"medicine_id": baby_care["id"], "quantity": baby_qty}
            ],
            "delivery_address": "Test Address for Mixed Cart Discount",
            "latitude": 12.9716,
            "longitude": 77.5946
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", headers=headers, json=order_data)
        assert response.status_code == 200
        
        order = response.json()
        
        # Calculate expected values
        med_subtotal = med_price * med_qty
        baby_subtotal = baby_care["price"] * baby_qty
        total_subtotal = med_subtotal + baby_subtotal
        
        med_cat_discount = med_subtotal * 0.10
        baby_cat_discount = baby_subtotal * 0.20
        total_cat_discount = med_cat_discount + baby_cat_discount
        
        medicine_after_cat = med_subtotal - med_cat_discount
        
        # Cart discount should be 10% of medicine portion only (since >= 3000)
        expected_cart_discount = medicine_after_cat * 0.10
        
        assert approx_equal(order["subtotal"], total_subtotal)
        assert approx_equal(order["category_discount"], total_cat_discount)
        assert medicine_after_cat >= 3000, f"Medicine after cat should be >= 3000, got {medicine_after_cat}"
        assert approx_equal(order["cart_discount"], expected_cart_discount), f"Cart discount should be 10% of medicine portion ({medicine_after_cat})"
        
        print(f"✓ Mixed cart: Medicine after cat={medicine_after_cat}, Cart discount={order['cart_discount']} (only on medicine)")


class TestOrderDetailDiscountFields:
    """Test that order detail endpoint returns discount fields"""
    
    def test_order_detail_has_discount_fields(self, customer_token, test_products):
        """GET /api/orders/{id} should return discount breakdown fields"""
        if "Medicine" not in test_products:
            pytest.skip("No Medicine product available")
        
        headers = {"Authorization": f"Bearer {customer_token}"}
        medicine = test_products["Medicine"]
        
        # Create an order
        order_data = {
            "items": [{"medicine_id": medicine["id"], "quantity": 5}],
            "delivery_address": "Test Address for Order Detail",
            "latitude": 12.9716,
            "longitude": 77.5946
        }
        
        create_response = requests.post(f"{BASE_URL}/api/orders", headers=headers, json=order_data)
        assert create_response.status_code == 200
        order_id = create_response.json()["id"]
        
        # Get order detail
        detail_response = requests.get(f"{BASE_URL}/api/orders/{order_id}", headers=headers)
        assert detail_response.status_code == 200
        
        order = detail_response.json()
        
        # Verify all discount fields are present
        assert "subtotal" in order, "Order should have subtotal field"
        assert "category_discount" in order, "Order should have category_discount field"
        assert "cart_discount" in order, "Order should have cart_discount field"
        assert "total_savings" in order, "Order should have total_savings field"
        assert "total_amount" in order, "Order should have total_amount field"
        
        # Verify values are consistent
        expected_total = order["subtotal"] - order["total_savings"]
        assert order["total_amount"] == expected_total, "total_amount should equal subtotal - total_savings"
        
        print(f"✓ Order detail has all discount fields: subtotal={order['subtotal']}, total_amount={order['total_amount']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
