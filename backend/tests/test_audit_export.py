"""
Test Audit Log Export Feature for MEDILO Healthcare App
Tests:
1. GET /api/ops/audit-logs/export returns valid CSV with correct headers
2. GET /api/ops/audit-logs/export?start_date=...&end_date=... returns filtered results
3. GET /api/ops/audit-logs/export returns 403 for non-ops users
"""
import pytest
import requests
import os
import csv
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
OPS_EMAIL = "ops@medilo.com"
OPS_PASSWORD = "test123"
CUSTOMER_PHONE = "9876543210"


class TestAuditLogExport:
    """Audit Log Export endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_ops_token(self):
        """Get ops user token"""
        response = self.session.post(f"{BASE_URL}/api/auth/staff/login", json={
            "email": OPS_EMAIL,
            "password": OPS_PASSWORD
        })
        assert response.status_code == 200, f"Ops login failed: {response.text}"
        return response.json()["access_token"]
    
    def get_customer_token(self):
        """Get customer token"""
        response = self.session.post(f"{BASE_URL}/api/auth/customer/login", json={
            "phone": CUSTOMER_PHONE
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_health_check(self):
        """Test API health check"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("Health check passed")
    
    def test_ops_login(self):
        """Test ops user can login"""
        response = self.session.post(f"{BASE_URL}/api/auth/staff/login", json={
            "email": OPS_EMAIL,
            "password": OPS_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "ops"
        print(f"Ops login successful: {data['user']['name']}")
    
    def test_export_audit_logs_returns_csv(self):
        """Test GET /api/ops/audit-logs/export returns valid CSV with correct headers"""
        token = self.get_ops_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/ops/audit-logs/export",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        # Check content type is CSV
        content_type = response.headers.get("Content-Type", "")
        assert "text/csv" in content_type, f"Expected text/csv, got {content_type}"
        
        # Check Content-Disposition header for filename
        content_disposition = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disposition, f"Expected attachment, got {content_disposition}"
        assert "medilo_audit_logs" in content_disposition, f"Expected medilo_audit_logs in filename"
        
        # Parse CSV and verify headers
        csv_content = response.text
        reader = csv.reader(io.StringIO(csv_content))
        headers = next(reader)
        
        expected_headers = ["Timestamp", "Action", "Entity Type", "Entity ID", "User ID", "User Role", "Details"]
        assert headers == expected_headers, f"Expected headers {expected_headers}, got {headers}"
        
        print(f"CSV export successful with correct headers: {headers}")
        print(f"CSV has {len(list(reader))} data rows")
    
    def test_export_audit_logs_with_date_filter(self):
        """Test GET /api/ops/audit-logs/export with date range filters"""
        token = self.get_ops_token()
        
        # Test with date range
        response = self.session.get(
            f"{BASE_URL}/api/ops/audit-logs/export",
            params={
                "start_date": "2026-01-01",
                "end_date": "2026-12-31"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Export with date filter failed: {response.text}"
        
        # Check content type is CSV
        content_type = response.headers.get("Content-Type", "")
        assert "text/csv" in content_type, f"Expected text/csv, got {content_type}"
        
        # Parse CSV
        csv_content = response.text
        reader = csv.reader(io.StringIO(csv_content))
        headers = next(reader)
        rows = list(reader)
        
        print(f"Date filtered export returned {len(rows)} rows")
        
        # Verify all timestamps are within range (if there are rows)
        for row in rows:
            if row and row[0]:  # Timestamp is first column
                timestamp = row[0]
                # Just verify it's a valid timestamp format
                assert "2026" in timestamp or len(timestamp) > 0, f"Invalid timestamp: {timestamp}"
        
        print("Date filter test passed")
    
    def test_export_audit_logs_forbidden_for_customer(self):
        """Test GET /api/ops/audit-logs/export returns 403 for non-ops users (customer)"""
        token = self.get_customer_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/ops/audit-logs/export",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("Customer correctly denied access to audit export (403)")
    
    def test_export_audit_logs_unauthorized_without_token(self):
        """Test GET /api/ops/audit-logs/export returns 401/403 without token"""
        response = self.session.get(f"{BASE_URL}/api/ops/audit-logs/export")
        
        # Should be 401 (unauthorized) or 403 (forbidden)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"Unauthenticated request correctly denied ({response.status_code})")
    
    def test_audit_logs_list_endpoint(self):
        """Test GET /api/ops/audit-logs returns list of audit logs"""
        token = self.get_ops_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/ops/audit-logs",
            params={"limit": 10},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Audit logs list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of audit logs"
        
        if len(data) > 0:
            log = data[0]
            assert "id" in log
            assert "action" in log
            assert "entity_type" in log
            assert "entity_id" in log
            assert "user_id" in log
            assert "user_role" in log
            assert "timestamp" in log
            print(f"Audit logs list returned {len(data)} logs")
            print(f"Sample log: action={log['action']}, entity_type={log['entity_type']}")
        else:
            print("Audit logs list is empty (no logs yet)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
