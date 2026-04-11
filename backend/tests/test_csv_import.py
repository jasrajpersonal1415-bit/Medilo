"""
CSV Import Feature Tests for MEDILO Pharmacy Management System
Tests: POST /api/ops/products/import/validate and POST /api/ops/products/import/confirm
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
OPS_EMAIL = "ops@medilo.com"
OPS_PASSWORD = "test123"
CUSTOMER_PHONE = "9876543210"


class TestCSVImportValidation:
    """Tests for POST /api/ops/products/import/validate endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get ops token for authenticated requests"""
        self.session = requests.Session()
        # Login as ops
        login_res = self.session.post(f"{BASE_URL}/api/auth/staff/login", json={
            "email": OPS_EMAIL,
            "password": OPS_PASSWORD
        })
        assert login_res.status_code == 200, f"Ops login failed: {login_res.text}"
        self.ops_token = login_res.json()["access_token"]
        self.ops_headers = {"Authorization": f"Bearer {self.ops_token}"}
        
        # Login as customer for permission tests
        cust_res = self.session.post(f"{BASE_URL}/api/auth/customer/login", json={
            "phone": CUSTOMER_PHONE
        })
        if cust_res.status_code == 200:
            self.customer_token = cust_res.json()["access_token"]
            self.customer_headers = {"Authorization": f"Bearer {self.customer_token}"}
        else:
            self.customer_token = None
            self.customer_headers = {}
    
    def test_validate_valid_csv(self):
        """Test: Valid CSV file returns preview with total_rows, new_entries, update_entries, errors"""
        csv_content = """Product Name,Category,Type,Batch,Expiry Date,Quantity,MRP,Purchase Price,Manufacturer
TEST_Paracetamol 500mg,Medicine,OTC,TESTB001,2027-06-15,500,12.50,8.00,Cipla
TEST_Vitamin D3,Wellness,,TESTB002,2028-01-10,1000,120.00,80.00,HealthKart"""
        
        files = {'file': ('test_products.csv', io.BytesIO(csv_content.encode()), 'text/csv')}
        response = self.session.post(
            f"{BASE_URL}/api/ops/products/import/validate",
            files=files,
            headers=self.ops_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "total_rows" in data, "Response missing total_rows"
        assert "new_entries" in data, "Response missing new_entries"
        assert "update_entries" in data, "Response missing update_entries"
        assert "errors" in data, "Response missing errors"
        assert "preview" in data, "Response missing preview"
        
        # Verify values
        assert data["total_rows"] == 2, f"Expected 2 rows, got {data['total_rows']}"
        print(f"✓ Valid CSV validation passed: {data['total_rows']} rows, {data['new_entries']} new, {data['update_entries']} updates")
    
    def test_validate_rejects_non_csv(self):
        """Test: Non-CSV files are rejected with 400 error"""
        txt_content = "This is not a CSV file"
        files = {'file': ('test.txt', io.BytesIO(txt_content.encode()), 'text/plain')}
        
        response = self.session.post(
            f"{BASE_URL}/api/ops/products/import/validate",
            files=files,
            headers=self.ops_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for non-CSV, got {response.status_code}"
        assert "CSV" in response.json().get("detail", ""), "Error should mention CSV"
        print("✓ Non-CSV file correctly rejected")
    
    def test_validate_reports_missing_columns(self):
        """Test: Missing required columns are reported"""
        # CSV missing 'Manufacturer' column
        csv_content = """Product Name,Category,Type,Batch,Expiry Date,Quantity,MRP,Purchase Price
TEST_Product,Medicine,OTC,B001,2027-06-15,500,12.50,8.00"""
        
        files = {'file': ('test.csv', io.BytesIO(csv_content.encode()), 'text/csv')}
        response = self.session.post(
            f"{BASE_URL}/api/ops/products/import/validate",
            files=files,
            headers=self.ops_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for missing columns, got {response.status_code}"
        detail = response.json().get("detail", "")
        assert "Manufacturer" in detail, f"Error should mention missing Manufacturer column: {detail}"
        print("✓ Missing columns correctly reported")
    
    def test_validate_reports_row_level_errors(self):
        """Test: Row-level validation errors (missing fields, invalid dates, invalid numbers)"""
        csv_content = """Product Name,Category,Type,Batch,Expiry Date,Quantity,MRP,Purchase Price,Manufacturer
,Medicine,OTC,B001,2027-06-15,500,12.50,8.00,Cipla
TEST_Product2,InvalidCategory,OTC,B002,2027-06-15,500,12.50,8.00,Cipla
TEST_Product3,Medicine,OTC,B003,invalid-date,500,12.50,8.00,Cipla
TEST_Product4,Medicine,OTC,B004,2027-06-15,notanumber,12.50,8.00,Cipla"""
        
        files = {'file': ('test.csv', io.BytesIO(csv_content.encode()), 'text/csv')}
        response = self.session.post(
            f"{BASE_URL}/api/ops/products/import/validate",
            files=files,
            headers=self.ops_headers
        )
        
        assert response.status_code == 200, f"Expected 200 (validation returns errors in body), got {response.status_code}"
        data = response.json()
        
        # Should have errors
        assert len(data["errors"]) > 0, "Expected validation errors for invalid rows"
        assert data["has_errors"] == True, "has_errors should be True"
        
        # Check specific error types
        errors_text = " ".join(data["errors"])
        assert "Product Name" in errors_text or "required" in errors_text.lower(), "Should report missing product name"
        print(f"✓ Row-level errors correctly reported: {len(data['errors'])} errors found")
    
    def test_validate_returns_403_for_non_ops(self):
        """Test: Non-ops users get 403 Forbidden"""
        if not self.customer_token:
            pytest.skip("Customer token not available")
        
        csv_content = """Product Name,Category,Type,Batch,Expiry Date,Quantity,MRP,Purchase Price,Manufacturer
TEST_Product,Medicine,OTC,B001,2027-06-15,500,12.50,8.00,Cipla"""
        
        files = {'file': ('test.csv', io.BytesIO(csv_content.encode()), 'text/csv')}
        response = self.session.post(
            f"{BASE_URL}/api/ops/products/import/validate",
            files=files,
            headers=self.customer_headers
        )
        
        assert response.status_code == 403, f"Expected 403 for customer, got {response.status_code}"
        print("✓ Non-ops user correctly denied access (403)")


class TestCSVImportConfirm:
    """Tests for POST /api/ops/products/import/confirm endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get ops token for authenticated requests"""
        self.session = requests.Session()
        # Login as ops
        login_res = self.session.post(f"{BASE_URL}/api/auth/staff/login", json={
            "email": OPS_EMAIL,
            "password": OPS_PASSWORD
        })
        assert login_res.status_code == 200, f"Ops login failed: {login_res.text}"
        self.ops_token = login_res.json()["access_token"]
        self.ops_headers = {"Authorization": f"Bearer {self.ops_token}"}
        
        # Login as customer for permission tests
        cust_res = self.session.post(f"{BASE_URL}/api/auth/customer/login", json={
            "phone": CUSTOMER_PHONE
        })
        if cust_res.status_code == 200:
            self.customer_token = cust_res.json()["access_token"]
            self.customer_headers = {"Authorization": f"Bearer {self.customer_token}"}
        else:
            self.customer_token = None
            self.customer_headers = {}
    
    def test_confirm_creates_new_products(self):
        """Test: Confirm endpoint creates new products in DB"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        rows = [
            {
                "name": f"TEST_NewProduct_{unique_id}",
                "product_type": "Medicine",
                "bucket": "OTC",
                "batch": f"TESTBATCH_{unique_id}",
                "expiry_date": "2027-12-31",
                "quantity": 100,
                "price": 25.00,
                "purchase_price": 15.00,
                "manufacturer": "TestPharma"
            }
        ]
        
        response = self.session.post(
            f"{BASE_URL}/api/ops/products/import/confirm",
            json={"rows": rows},
            headers=self.ops_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["created"] >= 1, f"Expected at least 1 created, got {data['created']}"
        assert data["total_processed"] >= 1, f"Expected total_processed >= 1"
        print(f"✓ New product created: {data['created']} created, {data['updated']} updated")
        
        # Verify product is searchable
        search_res = self.session.get(
            f"{BASE_URL}/api/medicines",
            params={"search": f"TEST_NewProduct_{unique_id}"}
        )
        assert search_res.status_code == 200
        medicines = search_res.json()
        assert len(medicines) >= 1, f"Created product not found in search"
        print(f"✓ Created product is immediately searchable")
    
    def test_confirm_updates_quantity_for_duplicate(self):
        """Test: Same product+batch updates quantity (adds to existing)"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        product_name = f"TEST_DuplicateTest_{unique_id}"
        batch = f"DUPBATCH_{unique_id}"
        
        # First import - create product with quantity 100
        rows1 = [{
            "name": product_name,
            "product_type": "Medicine",
            "bucket": "OTC",
            "batch": batch,
            "expiry_date": "2027-12-31",
            "quantity": 100,
            "price": 50.00,
            "purchase_price": 30.00,
            "manufacturer": "TestPharma"
        }]
        
        res1 = self.session.post(
            f"{BASE_URL}/api/ops/products/import/confirm",
            json={"rows": rows1},
            headers=self.ops_headers
        )
        assert res1.status_code == 200
        assert res1.json()["created"] == 1
        
        # Second import - same product+batch with quantity 50 (should add to existing)
        rows2 = [{
            "name": product_name,
            "product_type": "Medicine",
            "bucket": "OTC",
            "batch": batch,
            "expiry_date": "2027-12-31",
            "quantity": 50,
            "price": 50.00,
            "purchase_price": 30.00,
            "manufacturer": "TestPharma"
        }]
        
        res2 = self.session.post(
            f"{BASE_URL}/api/ops/products/import/confirm",
            json={"rows": rows2},
            headers=self.ops_headers
        )
        assert res2.status_code == 200
        assert res2.json()["updated"] == 1, f"Expected 1 update, got {res2.json()['updated']}"
        
        # Verify quantity was added (100 + 50 = 150)
        search_res = self.session.get(
            f"{BASE_URL}/api/medicines",
            params={"search": product_name}
        )
        medicines = search_res.json()
        found = [m for m in medicines if m["name"] == product_name and m["batch"] == batch]
        assert len(found) == 1, f"Expected 1 product, found {len(found)}"
        assert found[0]["quantity"] == 150, f"Expected quantity 150, got {found[0]['quantity']}"
        print(f"✓ Duplicate product+batch correctly updated quantity: 100 + 50 = 150")
    
    def test_confirm_creates_new_entry_for_different_batch(self):
        """Test: Same product with different batch creates new entry"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        product_name = f"TEST_MultiBatch_{unique_id}"
        
        # First batch
        rows1 = [{
            "name": product_name,
            "product_type": "Medicine",
            "bucket": "OTC",
            "batch": f"BATCH_A_{unique_id}",
            "expiry_date": "2027-06-30",
            "quantity": 100,
            "price": 50.00,
            "purchase_price": 30.00,
            "manufacturer": "TestPharma"
        }]
        
        res1 = self.session.post(
            f"{BASE_URL}/api/ops/products/import/confirm",
            json={"rows": rows1},
            headers=self.ops_headers
        )
        assert res1.status_code == 200
        
        # Second batch (different batch number)
        rows2 = [{
            "name": product_name,
            "product_type": "Medicine",
            "bucket": "OTC",
            "batch": f"BATCH_B_{unique_id}",
            "expiry_date": "2027-12-31",
            "quantity": 200,
            "price": 50.00,
            "purchase_price": 30.00,
            "manufacturer": "TestPharma"
        }]
        
        res2 = self.session.post(
            f"{BASE_URL}/api/ops/products/import/confirm",
            json={"rows": rows2},
            headers=self.ops_headers
        )
        assert res2.status_code == 200
        assert res2.json()["created"] == 1, f"Expected new entry for different batch"
        
        # Verify both entries exist
        search_res = self.session.get(
            f"{BASE_URL}/api/medicines",
            params={"search": product_name}
        )
        medicines = search_res.json()
        found = [m for m in medicines if m["name"] == product_name]
        assert len(found) == 2, f"Expected 2 entries for different batches, found {len(found)}"
        print(f"✓ Different batch correctly created new entry: {len(found)} entries")
    
    def test_confirm_returns_403_for_non_ops(self):
        """Test: Non-ops users get 403 Forbidden on confirm"""
        if not self.customer_token:
            pytest.skip("Customer token not available")
        
        rows = [{
            "name": "TEST_Unauthorized",
            "product_type": "Medicine",
            "bucket": "OTC",
            "batch": "UNAUTH001",
            "expiry_date": "2027-12-31",
            "quantity": 100,
            "price": 25.00,
            "purchase_price": 15.00,
            "manufacturer": "TestPharma"
        }]
        
        response = self.session.post(
            f"{BASE_URL}/api/ops/products/import/confirm",
            json={"rows": rows},
            headers=self.customer_headers
        )
        
        assert response.status_code == 403, f"Expected 403 for customer, got {response.status_code}"
        print("✓ Non-ops user correctly denied access to confirm (403)")


class TestMedicinesSearchAfterImport:
    """Test that imported products are immediately searchable via GET /api/medicines"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        # Login as ops
        login_res = self.session.post(f"{BASE_URL}/api/auth/staff/login", json={
            "email": OPS_EMAIL,
            "password": OPS_PASSWORD
        })
        assert login_res.status_code == 200
        self.ops_token = login_res.json()["access_token"]
        self.ops_headers = {"Authorization": f"Bearer {self.ops_token}"}
    
    def test_imported_products_searchable(self):
        """Test: Imported products appear in GET /api/medicines search"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        product_name = f"TEST_Searchable_{unique_id}"
        
        # Import product
        rows = [{
            "name": product_name,
            "product_type": "Wellness",
            "bucket": None,
            "batch": f"SEARCH_{unique_id}",
            "expiry_date": "2028-01-01",
            "quantity": 500,
            "price": 99.00,
            "purchase_price": 60.00,
            "manufacturer": "SearchTest Inc"
        }]
        
        import_res = self.session.post(
            f"{BASE_URL}/api/ops/products/import/confirm",
            json={"rows": rows},
            headers=self.ops_headers
        )
        assert import_res.status_code == 200
        
        # Immediately search for it
        search_res = self.session.get(
            f"{BASE_URL}/api/medicines",
            params={"search": product_name}
        )
        assert search_res.status_code == 200
        medicines = search_res.json()
        
        found = [m for m in medicines if product_name in m["name"]]
        assert len(found) >= 1, f"Imported product not found in search results"
        
        # Verify product details
        product = found[0]
        assert product["quantity"] == 500
        assert product["price"] == 99.00
        assert product["manufacturer"] == "SearchTest Inc"
        print(f"✓ Imported product immediately searchable with correct details")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
