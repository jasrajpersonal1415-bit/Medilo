"""
Test suite for MEDILO Multi-Category Quick Commerce Features
Tests: Categories API, Product filtering by category, CSV import with new categories
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
OPS_EMAIL = "ops@medilo.com"
OPS_PASSWORD = "test123"
CUSTOMER_PHONE = "9876543210"


class TestCategoriesAPI:
    """Test GET /api/categories endpoint"""
    
    def test_categories_returns_5_categories(self):
        """Verify /api/categories returns exactly 5 categories"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        categories = response.json()
        assert len(categories) == 5, f"Expected 5 categories, got {len(categories)}"
        
        # Verify category IDs
        category_ids = [c['id'] for c in categories]
        expected_ids = ['Medicine', 'Beauty & Personal Care', 'Wellness', 'Baby Care', 'Device']
        for expected_id in expected_ids:
            assert expected_id in category_ids, f"Missing category: {expected_id}"
        
        print(f"✓ Categories API returns 5 categories: {category_ids}")
    
    def test_categories_have_required_fields(self):
        """Verify each category has id, name, icon, description, count"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        
        categories = response.json()
        required_fields = ['id', 'name', 'icon', 'description', 'count']
        
        for cat in categories:
            for field in required_fields:
                assert field in cat, f"Category {cat.get('id', 'unknown')} missing field: {field}"
            assert isinstance(cat['count'], int), f"Count should be int, got {type(cat['count'])}"
        
        print("✓ All categories have required fields (id, name, icon, description, count)")
    
    def test_categories_count_is_accurate(self):
        """Verify category counts match actual product counts"""
        response = requests.get(f"{BASE_URL}/api/categories")
        categories = response.json()
        
        for cat in categories:
            # Get products for this category
            products_response = requests.get(f"{BASE_URL}/api/medicines", params={"product_type": cat['id']})
            assert products_response.status_code == 200
            actual_count = len(products_response.json())
            
            assert cat['count'] == actual_count, f"Category {cat['id']}: expected count {actual_count}, got {cat['count']}"
        
        print("✓ Category counts match actual product counts")


class TestProductFilterByCategory:
    """Test GET /api/medicines with product_type filter"""
    
    def test_filter_by_medicine_category(self):
        """Test filtering products by Medicine category"""
        response = requests.get(f"{BASE_URL}/api/medicines", params={"product_type": "Medicine"})
        assert response.status_code == 200
        
        products = response.json()
        for product in products:
            assert product.get('product_type') == 'Medicine', f"Product {product['name']} has wrong type: {product.get('product_type')}"
        
        print(f"✓ Medicine filter works - {len(products)} products returned")
    
    def test_filter_by_beauty_personal_care(self):
        """Test filtering products by Beauty & Personal Care category"""
        response = requests.get(f"{BASE_URL}/api/medicines", params={"product_type": "Beauty & Personal Care"})
        assert response.status_code == 200
        
        products = response.json()
        for product in products:
            assert product.get('product_type') == 'Beauty & Personal Care', f"Product {product['name']} has wrong type"
        
        print(f"✓ Beauty & Personal Care filter works - {len(products)} products returned")
    
    def test_filter_by_wellness(self):
        """Test filtering products by Wellness category"""
        response = requests.get(f"{BASE_URL}/api/medicines", params={"product_type": "Wellness"})
        assert response.status_code == 200
        
        products = response.json()
        for product in products:
            assert product.get('product_type') == 'Wellness', f"Product {product['name']} has wrong type"
        
        print(f"✓ Wellness filter works - {len(products)} products returned")
    
    def test_filter_by_baby_care(self):
        """Test filtering products by Baby Care category (may be empty)"""
        response = requests.get(f"{BASE_URL}/api/medicines", params={"product_type": "Baby Care"})
        assert response.status_code == 200
        
        products = response.json()
        for product in products:
            assert product.get('product_type') == 'Baby Care', f"Product {product['name']} has wrong type"
        
        print(f"✓ Baby Care filter works - {len(products)} products returned (may be 0)")
    
    def test_filter_by_device(self):
        """Test filtering products by Device category"""
        response = requests.get(f"{BASE_URL}/api/medicines", params={"product_type": "Device"})
        assert response.status_code == 200
        
        products = response.json()
        for product in products:
            assert product.get('product_type') == 'Device', f"Product {product['name']} has wrong type"
        
        print(f"✓ Device filter works - {len(products)} products returned")


class TestCSVImportCategories:
    """Test CSV import accepts new category values"""
    
    @pytest.fixture
    def ops_token(self):
        """Get ops authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/staff/login", json={
            "email": OPS_EMAIL,
            "password": OPS_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Could not authenticate as ops")
        return response.json()['access_token']
    
    def test_csv_accepts_beauty_personal_care(self, ops_token):
        """Test CSV import accepts 'Beauty & Personal Care' as valid category"""
        csv_content = """Product Name,Category,Type,Batch,Expiry Date,Quantity,MRP,Purchase Price,Manufacturer
TEST_Beauty_Product,Beauty & Personal Care,,BATCH001,2026-12-31,100,299.00,200.00,Test Brand"""
        
        files = {'file': ('test.csv', csv_content, 'text/csv')}
        headers = {'Authorization': f'Bearer {ops_token}'}
        
        response = requests.post(
            f"{BASE_URL}/api/ops/products/import/validate",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should have no errors for valid category
        category_errors = [e for e in data.get('errors', []) if 'Category' in e]
        assert len(category_errors) == 0, f"Unexpected category errors: {category_errors}"
        
        print("✓ CSV import accepts 'Beauty & Personal Care' category")
    
    def test_csv_accepts_baby_care(self, ops_token):
        """Test CSV import accepts 'Baby Care' as valid category"""
        csv_content = """Product Name,Category,Type,Batch,Expiry Date,Quantity,MRP,Purchase Price,Manufacturer
TEST_Baby_Product,Baby Care,,BATCH002,2026-12-31,50,199.00,150.00,Baby Brand"""
        
        files = {'file': ('test.csv', csv_content, 'text/csv')}
        headers = {'Authorization': f'Bearer {ops_token}'}
        
        response = requests.post(
            f"{BASE_URL}/api/ops/products/import/validate",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should have no errors for valid category
        category_errors = [e for e in data.get('errors', []) if 'Category' in e]
        assert len(category_errors) == 0, f"Unexpected category errors: {category_errors}"
        
        print("✓ CSV import accepts 'Baby Care' category")


class TestOpsProductTypeDropdown:
    """Test that Ops can create products with all 5 categories"""
    
    @pytest.fixture
    def ops_token(self):
        """Get ops authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/staff/login", json={
            "email": OPS_EMAIL,
            "password": OPS_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Could not authenticate as ops")
        return response.json()['access_token']
    
    def test_create_beauty_personal_care_product(self, ops_token):
        """Test creating a Beauty & Personal Care product"""
        headers = {'Authorization': f'Bearer {ops_token}'}
        product_data = {
            "name": "TEST_Beauty_Cream",
            "generic_name": "Moisturizing Cream",
            "manufacturer": "Test Beauty Co",
            "bucket": None,
            "strength": "",
            "form": "cream",
            "pack_size": "50ml",
            "price": 299.00,
            "product_type": "Beauty & Personal Care",
            "description": "Test beauty product"
        }
        
        response = requests.post(f"{BASE_URL}/api/medicines", json=product_data, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        created = response.json()
        assert created['product_type'] == 'Beauty & Personal Care'
        assert created['name'] == 'TEST_Beauty_Cream'
        
        # Cleanup - delete the test product
        requests.delete(f"{BASE_URL}/api/medicines/{created['id']}", headers=headers)
        
        print("✓ Can create Beauty & Personal Care product via API")
    
    def test_create_baby_care_product(self, ops_token):
        """Test creating a Baby Care product"""
        headers = {'Authorization': f'Bearer {ops_token}'}
        product_data = {
            "name": "TEST_Baby_Lotion",
            "generic_name": "Baby Moisturizer",
            "manufacturer": "Test Baby Co",
            "bucket": None,
            "strength": "",
            "form": "lotion",
            "pack_size": "100ml",
            "price": 199.00,
            "product_type": "Baby Care",
            "description": "Test baby product"
        }
        
        response = requests.post(f"{BASE_URL}/api/medicines", json=product_data, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        created = response.json()
        assert created['product_type'] == 'Baby Care'
        assert created['name'] == 'TEST_Baby_Lotion'
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/medicines/{created['id']}", headers=headers)
        
        print("✓ Can create Baby Care product via API")


class TestCustomerAuth:
    """Test customer authentication for frontend testing"""
    
    def test_customer_login(self):
        """Test customer can login with phone number"""
        response = requests.post(f"{BASE_URL}/api/auth/customer/login", json={
            "phone": CUSTOMER_PHONE
        })
        
        if response.status_code == 404:
            # Customer not registered, try to register
            response = requests.post(f"{BASE_URL}/api/auth/customer/register", json={
                "phone": CUSTOMER_PHONE,
                "name": "Test Customer"
            })
            if response.status_code == 400:  # Already registered
                response = requests.post(f"{BASE_URL}/api/auth/customer/login", json={
                    "phone": CUSTOMER_PHONE
                })
        
        assert response.status_code == 200, f"Customer login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert 'access_token' in data
        assert data['user']['role'] == 'customer'
        
        print(f"✓ Customer login works - token received")
        return data['access_token']


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
