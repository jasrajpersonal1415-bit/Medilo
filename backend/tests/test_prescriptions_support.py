"""
Test suite for Phase 2 Customer Profile features:
- Prescriptions: upload, list, delete
- Support Tickets: create, list, get detail, reply
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CUSTOMER_PHONE = "9876543210"


class TestPrescriptions:
    """Prescription upload, list, delete tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as customer before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/customer/login", json={"phone": CUSTOMER_PHONE})
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_upload_prescription_jpeg(self):
        """Test uploading a JPEG prescription"""
        # Create a fake JPEG file (minimal valid JPEG header)
        jpeg_header = bytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00])
        fake_jpeg = jpeg_header + b'\x00' * 100
        
        files = {'file': ('test_prescription.jpg', io.BytesIO(fake_jpeg), 'image/jpeg')}
        response = requests.post(
            f"{BASE_URL}/api/customer/prescriptions",
            headers=self.headers,
            files=files
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert "file_path" in data
        assert "file_name" in data
        assert data["file_name"] == "test_prescription.jpg"
        assert "file_type" in data
        assert data["file_type"] == "image/jpeg"
        assert "file_size" in data
        assert data["file_size"] > 0
        assert "created_at" in data
        
        # Store for cleanup
        self.prescription_id = data["id"]
        print(f"SUCCESS: Uploaded prescription {data['id']}")
    
    def test_upload_prescription_png(self):
        """Test uploading a PNG prescription"""
        # Create a minimal valid PNG file
        png_header = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
        fake_png = png_header + b'\x00' * 100
        
        files = {'file': ('test_prescription.png', io.BytesIO(fake_png), 'image/png')}
        response = requests.post(
            f"{BASE_URL}/api/customer/prescriptions",
            headers=self.headers,
            files=files
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert data["file_type"] == "image/png"
        print(f"SUCCESS: Uploaded PNG prescription {data['id']}")
    
    def test_upload_prescription_pdf(self):
        """Test uploading a PDF prescription"""
        # Create a minimal PDF file
        fake_pdf = b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'
        
        files = {'file': ('test_prescription.pdf', io.BytesIO(fake_pdf), 'application/pdf')}
        response = requests.post(
            f"{BASE_URL}/api/customer/prescriptions",
            headers=self.headers,
            files=files
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert data["file_type"] == "application/pdf"
        print(f"SUCCESS: Uploaded PDF prescription {data['id']}")
    
    def test_upload_prescription_invalid_type(self):
        """Test uploading an invalid file type (should fail)"""
        fake_txt = b'This is a text file'
        
        files = {'file': ('test.txt', io.BytesIO(fake_txt), 'text/plain')}
        response = requests.post(
            f"{BASE_URL}/api/customer/prescriptions",
            headers=self.headers,
            files=files
        )
        
        assert response.status_code == 400, f"Should reject invalid file type: {response.text}"
        print("SUCCESS: Invalid file type rejected")
    
    def test_list_prescriptions(self):
        """Test listing prescriptions"""
        response = requests.get(
            f"{BASE_URL}/api/customer/prescriptions",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"List failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Listed {len(data)} prescriptions")
        
        # Verify sorted by date desc (most recent first)
        if len(data) >= 2:
            for i in range(len(data) - 1):
                assert data[i]["created_at"] >= data[i+1]["created_at"], "Not sorted by date desc"
            print("SUCCESS: Prescriptions sorted by date desc")
    
    def test_delete_prescription(self):
        """Test deleting a prescription"""
        # First upload one
        jpeg_header = bytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00])
        fake_jpeg = jpeg_header + b'\x00' * 100
        
        files = {'file': ('to_delete.jpg', io.BytesIO(fake_jpeg), 'image/jpeg')}
        upload_response = requests.post(
            f"{BASE_URL}/api/customer/prescriptions",
            headers=self.headers,
            files=files
        )
        assert upload_response.status_code == 200
        prescription_id = upload_response.json()["id"]
        
        # Now delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/customer/prescriptions/{prescription_id}",
            headers=self.headers
        )
        
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        print(f"SUCCESS: Deleted prescription {prescription_id}")
        
        # Verify it's gone from list
        list_response = requests.get(
            f"{BASE_URL}/api/customer/prescriptions",
            headers=self.headers
        )
        prescriptions = list_response.json()
        assert not any(p["id"] == prescription_id for p in prescriptions), "Prescription still in list"
        print("SUCCESS: Prescription removed from list")
    
    def test_delete_nonexistent_prescription(self):
        """Test deleting a non-existent prescription"""
        response = requests.delete(
            f"{BASE_URL}/api/customer/prescriptions/nonexistent-id-12345",
            headers=self.headers
        )
        
        assert response.status_code == 404, f"Should return 404: {response.text}"
        print("SUCCESS: Non-existent prescription returns 404")


class TestSupportTickets:
    """Support ticket create, list, get, reply tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as customer before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/customer/login", json={"phone": CUSTOMER_PHONE})
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_ticket_order_issue(self):
        """Test creating a support ticket with Order Issue category"""
        ticket_data = {
            "subject": "TEST_Order not delivered",
            "category": "Order Issue",
            "description": "My order was supposed to arrive yesterday but hasn't been delivered yet."
        }
        
        response = requests.post(
            f"{BASE_URL}/api/customer/support-tickets",
            headers=self.headers,
            json=ticket_data
        )
        
        assert response.status_code == 200, f"Create ticket failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert "ticket_number" in data
        assert data["ticket_number"].startswith("TKT-"), f"Invalid ticket number format: {data['ticket_number']}"
        assert data["subject"] == ticket_data["subject"]
        assert data["category"] == ticket_data["category"]
        assert data["description"] == ticket_data["description"]
        assert data["status"] == "Open"
        assert "messages" in data
        assert len(data["messages"]) == 1
        assert data["messages"][0]["sender"] == "customer"
        assert data["messages"][0]["message"] == ticket_data["description"]
        assert "created_at" in data
        assert "updated_at" in data
        
        print(f"SUCCESS: Created ticket {data['ticket_number']}")
        self.ticket_id = data["id"]
    
    def test_create_ticket_all_categories(self):
        """Test creating tickets with all valid categories"""
        categories = [
            "Order Issue", "Delivery Issue", "Payment Issue",
            "Product Issue", "Prescription Issue", "Account Issue", "Other"
        ]
        
        for category in categories:
            ticket_data = {
                "subject": f"TEST_{category} test",
                "category": category,
                "description": f"Testing {category} category"
            }
            
            response = requests.post(
                f"{BASE_URL}/api/customer/support-tickets",
                headers=self.headers,
                json=ticket_data
            )
            
            assert response.status_code == 200, f"Create ticket with {category} failed: {response.text}"
            assert response.json()["category"] == category
            print(f"SUCCESS: Created ticket with category '{category}'")
    
    def test_create_ticket_with_order_id(self):
        """Test creating a ticket with optional order_id"""
        ticket_data = {
            "subject": "TEST_Issue with specific order",
            "category": "Order Issue",
            "description": "Problem with my order",
            "order_id": "test-order-123"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/customer/support-tickets",
            headers=self.headers,
            json=ticket_data
        )
        
        assert response.status_code == 200, f"Create ticket failed: {response.text}"
        data = response.json()
        assert data["order_id"] == "test-order-123"
        print("SUCCESS: Created ticket with order_id")
    
    def test_create_ticket_missing_subject(self):
        """Test creating a ticket without subject (should fail)"""
        ticket_data = {
            "category": "Order Issue",
            "description": "Missing subject"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/customer/support-tickets",
            headers=self.headers,
            json=ticket_data
        )
        
        assert response.status_code == 422, f"Should fail validation: {response.text}"
        print("SUCCESS: Missing subject rejected")
    
    def test_list_tickets(self):
        """Test listing support tickets"""
        response = requests.get(
            f"{BASE_URL}/api/customer/support-tickets",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"List tickets failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Listed {len(data)} tickets")
        
        # Verify sorted by date desc
        if len(data) >= 2:
            for i in range(len(data) - 1):
                assert data[i]["created_at"] >= data[i+1]["created_at"], "Not sorted by date desc"
            print("SUCCESS: Tickets sorted by date desc")
    
    def test_get_ticket_detail(self):
        """Test getting ticket detail with messages"""
        # First create a ticket
        ticket_data = {
            "subject": "TEST_Detail test ticket",
            "category": "Other",
            "description": "Testing ticket detail endpoint"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/customer/support-tickets",
            headers=self.headers,
            json=ticket_data
        )
        assert create_response.status_code == 200
        ticket_id = create_response.json()["id"]
        
        # Get detail
        detail_response = requests.get(
            f"{BASE_URL}/api/customer/support-tickets/{ticket_id}",
            headers=self.headers
        )
        
        assert detail_response.status_code == 200, f"Get detail failed: {detail_response.text}"
        data = detail_response.json()
        
        assert data["id"] == ticket_id
        assert "messages" in data
        assert isinstance(data["messages"], list)
        assert len(data["messages"]) >= 1
        print(f"SUCCESS: Got ticket detail with {len(data['messages'])} messages")
    
    def test_get_nonexistent_ticket(self):
        """Test getting a non-existent ticket"""
        response = requests.get(
            f"{BASE_URL}/api/customer/support-tickets/nonexistent-id-12345",
            headers=self.headers
        )
        
        assert response.status_code == 404, f"Should return 404: {response.text}"
        print("SUCCESS: Non-existent ticket returns 404")
    
    def test_reply_to_ticket(self):
        """Test replying to a ticket"""
        # First create a ticket
        ticket_data = {
            "subject": "TEST_Reply test ticket",
            "category": "Other",
            "description": "Testing reply functionality"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/customer/support-tickets",
            headers=self.headers,
            json=ticket_data
        )
        assert create_response.status_code == 200
        ticket_id = create_response.json()["id"]
        
        # Reply to ticket
        reply_response = requests.post(
            f"{BASE_URL}/api/customer/support-tickets/{ticket_id}/reply",
            headers=self.headers,
            json={"message": "This is my follow-up message"}
        )
        
        assert reply_response.status_code == 200, f"Reply failed: {reply_response.text}"
        print("SUCCESS: Reply sent")
        
        # Verify reply was added
        detail_response = requests.get(
            f"{BASE_URL}/api/customer/support-tickets/{ticket_id}",
            headers=self.headers
        )
        data = detail_response.json()
        
        assert len(data["messages"]) == 2, f"Expected 2 messages, got {len(data['messages'])}"
        assert data["messages"][1]["sender"] == "customer"
        assert data["messages"][1]["message"] == "This is my follow-up message"
        print("SUCCESS: Reply added to messages array")
    
    def test_reply_empty_message(self):
        """Test replying with empty message (should fail)"""
        # First create a ticket
        ticket_data = {
            "subject": "TEST_Empty reply test",
            "category": "Other",
            "description": "Testing empty reply"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/customer/support-tickets",
            headers=self.headers,
            json=ticket_data
        )
        assert create_response.status_code == 200
        ticket_id = create_response.json()["id"]
        
        # Try empty reply
        reply_response = requests.post(
            f"{BASE_URL}/api/customer/support-tickets/{ticket_id}/reply",
            headers=self.headers,
            json={"message": ""}
        )
        
        assert reply_response.status_code == 400, f"Should reject empty message: {reply_response.text}"
        print("SUCCESS: Empty reply rejected")
    
    def test_reply_to_nonexistent_ticket(self):
        """Test replying to a non-existent ticket"""
        response = requests.post(
            f"{BASE_URL}/api/customer/support-tickets/nonexistent-id-12345/reply",
            headers=self.headers,
            json={"message": "Test reply"}
        )
        
        assert response.status_code == 404, f"Should return 404: {response.text}"
        print("SUCCESS: Reply to non-existent ticket returns 404")


class TestFileServing:
    """Test file serving endpoint for prescriptions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as customer before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/customer/login", json={"phone": CUSTOMER_PHONE})
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_serve_uploaded_file(self):
        """Test that uploaded prescription can be served via /api/files/{path}"""
        # Upload a prescription
        jpeg_header = bytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00])
        fake_jpeg = jpeg_header + b'\x00' * 100
        
        files = {'file': ('serve_test.jpg', io.BytesIO(fake_jpeg), 'image/jpeg')}
        upload_response = requests.post(
            f"{BASE_URL}/api/customer/prescriptions",
            headers=self.headers,
            files=files
        )
        assert upload_response.status_code == 200
        file_path = upload_response.json()["file_path"]
        
        # Try to serve the file (public endpoint, no auth needed)
        serve_response = requests.get(f"{BASE_URL}/api/files/{file_path}")
        
        assert serve_response.status_code == 200, f"File serve failed: {serve_response.text}"
        assert "image" in serve_response.headers.get("Content-Type", "")
        print(f"SUCCESS: File served from {file_path}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
