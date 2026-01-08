#!/usr/bin/env python3
"""
MEDILO Healthcare API Testing Suite
Tests all backend endpoints for the healthcare pilot application
"""

import requests
import sys
import json
from datetime import datetime
import base64

class MediloAPITester:
    def __init__(self, base_url="https://meditrack-28.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tokens = {}  # Store tokens for different user types
        self.users = {}   # Store user data
        self.test_data = {}  # Store created test data
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append(f"{name}: {details}")
        print()

    def make_request(self, method, endpoint, data=None, token=None, expected_status=200):
        """Make HTTP request with error handling"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            
            success = response.status_code == expected_status
            return success, response
            
        except requests.exceptions.RequestException as e:
            return False, str(e)

    def generate_test_prescription(self):
        """Generate a test prescription image as base64"""
        # Create a simple test image as base64 (1x1 pixel JPEG)
        # This is a minimal valid JPEG header + data
        jpeg_data = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x11\x08\x00\x01\x00\x01\x01\x01\x11\x00\x02\x11\x01\x03\x11\x01\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00\x3f\x00\xaa\xff\xd9'
        return base64.b64encode(jpeg_data).decode()

    def test_health_check(self):
        """Test health endpoint"""
        success, response = self.make_request('GET', 'health')
        if success:
            data = response.json()
            self.log_test("Health Check", True, f"Status: {data.get('status')}")
        else:
            self.log_test("Health Check", False, f"Failed: {response}")

    def test_customer_auth(self):
        """Test customer registration and login"""
        # Test customer registration
        customer_data = {
            "phone": "9876543210",
            "name": "Test Customer"
        }
        
        success, response = self.make_request('POST', 'auth/customer/register', customer_data, expected_status=200)
        if success:
            data = response.json()
            self.tokens['customer'] = data['access_token']
            self.users['customer'] = data['user']
            self.log_test("Customer Registration", True, f"Token received, User ID: {data['user']['id']}")
        else:
            self.log_test("Customer Registration", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
            return

        # Test customer login
        login_data = {"phone": "9876543210"}
        success, response = self.make_request('POST', 'auth/customer/login', login_data)
        if success:
            data = response.json()
            self.log_test("Customer Login", True, f"Login successful")
        else:
            self.log_test("Customer Login", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_staff_auth(self):
        """Test staff registration and login for all roles"""
        roles = ['ops', 'pharmacist', 'pharmacy_staff']
        
        for role in roles:
            # Register staff
            staff_data = {
                "email": f"test_{role}@medilo.com",
                "password": "TestPass123!",
                "name": f"Test {role.title()}",
                "role": role
            }
            
            success, response = self.make_request('POST', 'auth/staff/register', staff_data)
            if success:
                data = response.json()
                self.tokens[role] = data['access_token']
                self.users[role] = data['user']
                self.log_test(f"{role.title()} Registration", True, f"User ID: {data['user']['id']}")
            else:
                self.log_test(f"{role.title()} Registration", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
                continue

            # Test login
            login_data = {
                "email": f"test_{role}@medilo.com",
                "password": "TestPass123!"
            }
            success, response = self.make_request('POST', 'auth/staff/login', login_data)
            if success:
                self.log_test(f"{role.title()} Login", True)
            else:
                self.log_test(f"{role.title()} Login", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_medicine_management(self):
        """Test medicine CRUD operations"""
        if 'ops' not in self.tokens:
            self.log_test("Medicine Management", False, "No ops token available")
            return

        # Create medicines for each bucket
        medicines = [
            {
                "name": "Paracetamol 500mg",
                "generic_name": "Paracetamol",
                "manufacturer": "GSK",
                "bucket": "OTC",
                "strength": "500mg",
                "form": "Tablet",
                "description": "Pain reliever"
            },
            {
                "name": "Amoxicillin 250mg",
                "generic_name": "Amoxicillin",
                "manufacturer": "Cipla",
                "bucket": "SCHEDULE_H",
                "strength": "250mg",
                "form": "Capsule",
                "description": "Antibiotic"
            },
            {
                "name": "Tramadol 50mg",
                "generic_name": "Tramadol",
                "manufacturer": "Sun Pharma",
                "bucket": "SCHEDULE_H1",
                "strength": "50mg",
                "form": "Tablet",
                "description": "Pain medication"
            }
        ]

        created_medicines = []
        for med_data in medicines:
            success, response = self.make_request('POST', 'medicines', med_data, self.tokens['ops'], 200)
            if success:
                data = response.json()
                created_medicines.append(data)
                self.log_test(f"Create {med_data['bucket']} Medicine", True, f"ID: {data['id']}")
            else:
                self.log_test(f"Create {med_data['bucket']} Medicine", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

        self.test_data['medicines'] = created_medicines

        # Test get all medicines
        success, response = self.make_request('GET', 'medicines')
        if success:
            data = response.json()
            self.log_test("Get All Medicines", True, f"Found {len(data)} medicines")
        else:
            self.log_test("Get All Medicines", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

        # Test search medicines
        success, response = self.make_request('GET', 'medicines?search=paracetamol')
        if success:
            data = response.json()
            self.log_test("Search Medicines", True, f"Found {len(data)} results")
        else:
            self.log_test("Search Medicines", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_pharmacy_management(self):
        """Test pharmacy CRUD operations"""
        if 'ops' not in self.tokens:
            self.log_test("Pharmacy Management", False, "No ops token available")
            return

        # Create pharmacy
        pharmacy_data = {
            "name": "Test Pharmacy",
            "license_number": "DL-2024-TEST-001",
            "address": "123 Test Street, Test Area",
            "city": "Mumbai",
            "pincode": "400001",
            "phone": "9876543211",
            "email": "test.pharmacy@medilo.com",
            "latitude": 19.0760,
            "longitude": 72.8777
        }

        success, response = self.make_request('POST', 'pharmacies', pharmacy_data, self.tokens['ops'], 201)
        if success:
            data = response.json()
            self.test_data['pharmacy'] = data
            self.log_test("Create Pharmacy", True, f"ID: {data['id']}")
        else:
            self.log_test("Create Pharmacy", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
            return

        # Test get all pharmacies
        success, response = self.make_request('GET', 'pharmacies', token=self.tokens['ops'])
        if success:
            data = response.json()
            self.log_test("Get All Pharmacies", True, f"Found {len(data)} pharmacies")
        else:
            self.log_test("Get All Pharmacies", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_order_workflow(self):
        """Test complete order workflow"""
        if 'customer' not in self.tokens or not self.test_data.get('medicines'):
            self.log_test("Order Workflow", False, "Missing prerequisites")
            return

        # Create order with mixed medicine buckets
        order_data = {
            "items": [
                {"medicine_id": self.test_data['medicines'][0]['id'], "quantity": 2},  # OTC
                {"medicine_id": self.test_data['medicines'][1]['id'], "quantity": 1},  # Schedule H
            ],
            "prescription_image": None,
            "schedule_h_declaration": True,  # For Schedule H
            "delivery_address": "456 Customer Street, Customer Area, Mumbai - 400002",
            "latitude": 19.0760,
            "longitude": 72.8777
        }

        success, response = self.make_request('POST', 'orders', order_data, self.tokens['customer'], 201)
        if success:
            data = response.json()
            self.test_data['order'] = data
            self.log_test("Create Order", True, f"Order ID: {data['id']}, Status: {data['status']}")
        else:
            self.log_test("Create Order", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
            return

        # Test pharmacist workflow
        if 'pharmacist' in self.tokens:
            # Get pending orders
            success, response = self.make_request('GET', 'pharmacist/orders?status=pending_pharmacist_review', token=self.tokens['pharmacist'])
            if success:
                data = response.json()
                self.log_test("Get Pending Orders (Pharmacist)", True, f"Found {len(data)} orders")
            else:
                self.log_test("Get Pending Orders (Pharmacist)", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

            # Approve order
            action_data = {"action": "approve", "notes": "Order approved for fulfillment"}
            success, response = self.make_request('POST', f"pharmacist/orders/{self.test_data['order']['id']}/action", action_data, self.tokens['pharmacist'])
            if success:
                data = response.json()
                self.log_test("Pharmacist Approve Order", True, f"New status: {data['status']}")
                
                # Assign pharmacy
                if self.test_data.get('pharmacy'):
                    success, response = self.make_request('POST', f"pharmacist/orders/{self.test_data['order']['id']}/assign?pharmacy_id={self.test_data['pharmacy']['id']}", {}, self.tokens['pharmacist'])
                    if success:
                        data = response.json()
                        self.log_test("Assign Pharmacy", True, f"Assigned to: {data['pharmacy_name']}")
                    else:
                        self.log_test("Assign Pharmacy", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
            else:
                self.log_test("Pharmacist Approve Order", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_order_with_prescription(self):
        """Test order requiring prescription"""
        if 'customer' not in self.tokens or not self.test_data.get('medicines'):
            self.log_test("Order with Prescription", False, "Missing prerequisites")
            return

        # Find Schedule H1 medicine
        h1_medicine = None
        for med in self.test_data['medicines']:
            if med['bucket'] == 'SCHEDULE_H1':
                h1_medicine = med
                break

        if not h1_medicine:
            self.log_test("Order with Prescription", False, "No Schedule H1 medicine available")
            return

        # Create order with prescription
        prescription_image = self.generate_test_prescription()
        order_data = {
            "items": [{"medicine_id": h1_medicine['id'], "quantity": 1}],
            "prescription_image": prescription_image,
            "schedule_h_declaration": False,
            "delivery_address": "789 Test Address, Mumbai - 400003",
            "latitude": 19.0760,
            "longitude": 72.8777
        }

        success, response = self.make_request('POST', 'orders', order_data, self.tokens['customer'], 201)
        if success:
            data = response.json()
            self.log_test("Create Order with Prescription", True, f"Order ID: {data['id']}")
        else:
            self.log_test("Create Order with Prescription", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_ops_functionality(self):
        """Test ops dashboard functionality"""
        if 'ops' not in self.tokens:
            self.log_test("Ops Functionality", False, "No ops token available")
            return

        # Test get all orders
        success, response = self.make_request('GET', 'ops/orders', token=self.tokens['ops'])
        if success:
            data = response.json()
            self.log_test("Ops - Get All Orders", True, f"Found {len(data)} orders")
        else:
            self.log_test("Ops - Get All Orders", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

        # Test get audit logs
        success, response = self.make_request('GET', 'ops/audit-logs', token=self.tokens['ops'])
        if success:
            data = response.json()
            self.log_test("Ops - Get Audit Logs", True, f"Found {len(data)} logs")
        else:
            self.log_test("Ops - Get Audit Logs", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

        # Test get users
        success, response = self.make_request('GET', 'ops/users', token=self.tokens['ops'])
        if success:
            data = response.json()
            self.log_test("Ops - Get All Users", True, f"Found {len(data)} users")
        else:
            self.log_test("Ops - Get All Users", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_authentication_protection(self):
        """Test that protected endpoints require authentication"""
        # Test accessing protected endpoint without token
        success, response = self.make_request('GET', 'auth/me', expected_status=401)
        if success:
            self.log_test("Auth Protection - No Token", True, "Correctly rejected")
        else:
            self.log_test("Auth Protection - No Token", False, f"Expected 401, got {response.status_code if hasattr(response, 'status_code') else response}")

        # Test with valid token
        if 'customer' in self.tokens:
            success, response = self.make_request('GET', 'auth/me', token=self.tokens['customer'])
            if success:
                data = response.json()
                self.log_test("Auth Protection - Valid Token", True, f"User: {data['name']}")
            else:
                self.log_test("Auth Protection - Valid Token", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def run_all_tests(self):
        """Run all test suites"""
        print("🏥 MEDILO Healthcare API Testing Suite")
        print("=" * 50)
        print()

        # Test suites in order
        self.test_health_check()
        self.test_customer_auth()
        self.test_staff_auth()
        self.test_authentication_protection()
        self.test_medicine_management()
        self.test_pharmacy_management()
        self.test_order_workflow()
        self.test_order_with_prescription()
        self.test_ops_functionality()

        # Print summary
        print("=" * 50)
        print(f"📊 TEST SUMMARY")
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"  - {test}")
        
        print()
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = MediloAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())