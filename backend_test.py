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
            if not success and hasattr(response, 'json'):
                try:
                    error_detail = response.json().get('detail', 'No detail')
                    print(f"    API Error: {error_detail}")
                except:
                    pass
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
        # Use timestamp to ensure unique phone number
        timestamp = str(int(datetime.now().timestamp()))[-6:]
        phone = f"98765{timestamp}"
        
        # Test customer registration
        customer_data = {
            "phone": phone,
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
        login_data = {"phone": phone}
        success, response = self.make_request('POST', 'auth/customer/login', login_data)
        if success:
            data = response.json()
            self.log_test("Customer Login", True, f"Login successful")
        else:
            self.log_test("Customer Login", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_staff_auth(self):
        """Test staff registration and login for all roles"""
        roles = ['ops', 'pharmacist', 'pharmacy_staff']
        timestamp = str(int(datetime.now().timestamp()))[-6:]
        
        for role in roles:
            # Register staff
            staff_data = {
                "email": f"test_{role}_{timestamp}@medilo.com",
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
                "email": f"test_{role}_{timestamp}@medilo.com",
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

        success, response = self.make_request('POST', 'pharmacies', pharmacy_data, self.tokens['ops'], 200)
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

        success, response = self.make_request('POST', 'orders', order_data, self.tokens['customer'])
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

        success, response = self.make_request('POST', 'orders', order_data, self.tokens['customer'])
        if success:
            data = response.json()
            self.log_test("Create Order with Prescription", True, f"Order ID: {data['id']}")
        else:
            self.log_test("Create Order with Prescription", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_delivery_partner_management(self):
        """Test delivery partner registration and login"""
        if 'ops' not in self.tokens:
            self.log_test("Delivery Partner Management", False, "No ops token available")
            return

        # Create delivery partner via ops
        timestamp = str(int(datetime.now().timestamp()))[-6:]
        delivery_data = {
            "phone": f"99887{timestamp}",
            "name": "Raj Kumar"
        }

        success, response = self.make_request('POST', 'auth/delivery/register', delivery_data, self.tokens['ops'])
        if success:
            data = response.json()
            self.test_data['delivery_partner'] = data
            self.log_test("Ops - Create Delivery Partner", True, f"ID: {data['id']}, Phone: {data['phone']}")
        else:
            self.log_test("Ops - Create Delivery Partner", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
            return

        # Test delivery partner login
        login_data = {"phone": delivery_data["phone"]}
        success, response = self.make_request('POST', 'auth/delivery/login', login_data)
        if success:
            data = response.json()
            self.tokens['delivery_partner'] = data['access_token']
            self.users['delivery_partner'] = data['user']
            self.log_test("Delivery Partner Login", True, f"Login successful")
        else:
            self.log_test("Delivery Partner Login", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_delivery_workflow(self):
        """Test complete delivery workflow"""
        if 'delivery_partner' not in self.tokens:
            self.log_test("Delivery Workflow", False, "No delivery partner token available")
            return

        # First, we need an order that's ready for pickup
        # Let's create a complete order workflow to get to ready_for_pickup status
        if not self.test_data.get('order') or not self.test_data.get('pharmacy'):
            self.log_test("Delivery Workflow", False, "Missing order or pharmacy data")
            return

        order_id = self.test_data['order']['id']
        pharmacy_id = self.test_data['pharmacy']['id']
        
        # Get the current order to check its pharmacy assignment
        success, response = self.make_request('GET', f'orders/{order_id}', token=self.tokens['customer'])
        if success:
            current_order = response.json()
            assigned_pharmacy_id = current_order.get('pharmacy_id')
            if not assigned_pharmacy_id:
                self.log_test("Delivery Workflow", False, "Order not assigned to any pharmacy")
                return
        else:
            self.log_test("Delivery Workflow", False, "Could not fetch order details")
            return
        
        # Create a pharmacy staff for the assigned pharmacy
        timestamp = str(int(datetime.now().timestamp()))[-6:]
        staff_data = {
            "email": f"pharmacy_staff_{timestamp}@medilo.com",
            "password": "TestPass123!",
            "name": "Test Pharmacy Staff",
            "role": "pharmacy_staff",
            "pharmacy_id": assigned_pharmacy_id  # Use the actual assigned pharmacy ID
        }
        
        success, response = self.make_request('POST', 'auth/staff/register', staff_data)
        if success:
            data = response.json()
            pharmacy_staff_token = data['access_token']
            self.log_test("Create Pharmacy Staff for Delivery Test", True, f"Staff ID: {data['user']['id']}")
        else:
            self.log_test("Create Pharmacy Staff for Delivery Test", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
            return

        # Pharmacy accepts the order
        action_data = {"action": "accept"}
        success, response = self.make_request('POST', f"pharmacy/orders/{order_id}/action", action_data, pharmacy_staff_token)
        if success:
            self.log_test("Pharmacy Accept Order", True, "Order accepted by pharmacy")
        else:
            self.log_test("Pharmacy Accept Order", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
            return

        # Confirm inventory
        inventory_data = {
            "items": [
                {
                    "medicine_id": self.test_data['medicines'][0]['id'],
                    "batch_number": "BATCH001",
                    "expiry_date": "2025-12-31",
                    "unit_price": 10.0
                },
                {
                    "medicine_id": self.test_data['medicines'][1]['id'],
                    "batch_number": "BATCH002", 
                    "expiry_date": "2025-12-31",
                    "unit_price": 25.0
                }
            ]
        }
        success, response = self.make_request('POST', f"pharmacy/orders/{order_id}/confirm-inventory", inventory_data, pharmacy_staff_token)
        if success:
            self.log_test("Pharmacy Confirm Inventory", True, "Inventory confirmed")
        else:
            self.log_test("Pharmacy Confirm Inventory", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
            return

        # Mark as preparing
        action_data = {"action": "mark_preparing"}
        success, response = self.make_request('POST', f"pharmacy/orders/{order_id}/action", action_data, pharmacy_staff_token)
        if success:
            self.log_test("Pharmacy Mark Preparing", True, "Order marked as preparing")
        else:
            self.log_test("Pharmacy Mark Preparing", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
            return

        # Mark as ready for pickup
        action_data = {"action": "mark_ready"}
        success, response = self.make_request('POST', f"pharmacy/orders/{order_id}/action", action_data, pharmacy_staff_token)
        if success:
            self.log_test("Pharmacy Mark Ready for Pickup", True, "Order ready for pickup")
        else:
            self.log_test("Pharmacy Mark Ready for Pickup", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
            return

        # Now test delivery partner workflow
        # Get available orders
        success, response = self.make_request('GET', 'delivery/orders', token=self.tokens['delivery_partner'])
        if success:
            data = response.json()
            available_orders = [o for o in data if o['status'] == 'ready_for_pickup' and not o.get('delivery_partner_id')]
            self.log_test("Delivery - Get Available Orders", True, f"Found {len(available_orders)} available orders")
            
            if available_orders:
                test_order = available_orders[0]
                
                # Accept delivery
                success, response = self.make_request('POST', f"delivery/orders/{test_order['id']}/accept", {}, self.tokens['delivery_partner'])
                if success:
                    self.log_test("Delivery - Accept Order", True, "Order accepted for delivery")
                else:
                    self.log_test("Delivery - Accept Order", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
                    return

                # Mark as picked up
                action_data = {"action": "pickup"}
                success, response = self.make_request('POST', f"delivery/orders/{test_order['id']}/action", action_data, self.tokens['delivery_partner'])
                if success:
                    self.log_test("Delivery - Mark Picked Up", True, "Order marked as picked up")
                else:
                    self.log_test("Delivery - Mark Picked Up", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
                    return

                # Mark as out for delivery
                action_data = {"action": "out_for_delivery"}
                success, response = self.make_request('POST', f"delivery/orders/{test_order['id']}/action", action_data, self.tokens['delivery_partner'])
                if success:
                    self.log_test("Delivery - Mark Out for Delivery", True, "Order out for delivery")
                else:
                    self.log_test("Delivery - Mark Out for Delivery", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
                    return

                # Mark as delivered
                action_data = {"action": "delivered"}
                success, response = self.make_request('POST', f"delivery/orders/{test_order['id']}/action", action_data, self.tokens['delivery_partner'])
                if success:
                    self.log_test("Delivery - Mark Delivered", True, "Order delivered successfully")
                else:
                    self.log_test("Delivery - Mark Delivered", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

                # Test issue reporting
                issue_data = {
                    "issue_type": "customer_unavailable",
                    "description": "Customer was not available at delivery address"
                }
                success, response = self.make_request('POST', f"delivery/orders/{test_order['id']}/report-issue", issue_data, self.tokens['delivery_partner'])
                if success:
                    data = response.json()
                    self.log_test("Delivery - Report Issue", True, f"Issue reported: {data.get('issue_id', 'N/A')}")
                else:
                    self.log_test("Delivery - Report Issue", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
            else:
                self.log_test("Delivery Workflow", False, "No available orders for delivery testing")
        else:
            self.log_test("Delivery - Get Available Orders", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_delivery_partner_data_privacy(self):
        """Test that delivery partners cannot see medicine names/prices"""
        if 'delivery_partner' not in self.tokens:
            self.log_test("Delivery Data Privacy", False, "No delivery partner token available")
            return

        # Get orders as delivery partner
        success, response = self.make_request('GET', 'delivery/orders', token=self.tokens['delivery_partner'])
        if success:
            data = response.json()
            if data:
                order = data[0]
                # Check that sensitive data is not exposed
                has_medicine_names = 'items' in order and any('medicine_name' in item for item in order.get('items', []))
                has_prices = 'total_amount' in order or any('unit_price' in item for item in order.get('items', []))
                
                if not has_medicine_names and not has_prices:
                    self.log_test("Delivery Data Privacy", True, "Medicine names and prices properly hidden")
                else:
                    self.log_test("Delivery Data Privacy", False, "Sensitive data exposed to delivery partner")
            else:
                self.log_test("Delivery Data Privacy", True, "No orders to test privacy (acceptable)")
        else:
            self.log_test("Delivery Data Privacy", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

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
        success, response = self.make_request('GET', 'auth/me', expected_status=403)
        if success:
            self.log_test("Auth Protection - No Token", True, "Correctly rejected")
        else:
            self.log_test("Auth Protection - No Token", False, f"Expected 403, got {response.status_code if hasattr(response, 'status_code') else response}")

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
        self.test_delivery_partner_management()
        self.test_delivery_workflow()
        self.test_delivery_partner_data_privacy()
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