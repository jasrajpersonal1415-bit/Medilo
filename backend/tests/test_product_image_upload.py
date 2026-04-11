"""
Test Product Image Upload Feature
Tests:
- POST /api/products/{product_id}/image - uploads image and returns image_path
- POST /api/products/{product_id}/image - rejects non-image files
- POST /api/products/{product_id}/image - rejects files > 5MB
- POST /api/products/{product_id}/image - returns 403 for non-ops users
- GET /api/files/{path} - serves uploaded image with correct content-type
- GET /api/medicines - products include image_path field when image was uploaded
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

# Product with existing image (Dolo 650)
PRODUCT_WITH_IMAGE_ID = "e2b792b9-13e8-4d1a-ba3c-21b75a959c85"
PRODUCT_WITH_IMAGE_PATH = "medilo/products/e2b792b9-13e8-4d1a-ba3c-21b75a959c85/09ee61a4-86fb-4151-ad28-bdfca8dcaf8e.jpg"


@pytest.fixture(scope="module")
def ops_token():
    """Get ops user token"""
    response = requests.post(f"{BASE_URL}/api/auth/staff/login", json={
        "email": OPS_EMAIL,
        "password": OPS_PASSWORD
    })
    assert response.status_code == 200, f"Ops login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def customer_token():
    """Get customer token"""
    response = requests.post(f"{BASE_URL}/api/auth/customer/login", json={
        "phone": CUSTOMER_PHONE
    })
    assert response.status_code == 200, f"Customer login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def test_product_id(ops_token):
    """Create a test product for image upload tests"""
    headers = {"Authorization": f"Bearer {ops_token}"}
    response = requests.post(f"{BASE_URL}/api/medicines", json={
        "name": "TEST_ImageUploadProduct",
        "generic_name": "Test Generic",
        "manufacturer": "Test Manufacturer",
        "bucket": "OTC",
        "strength": "100mg",
        "form": "Tablet",
        "pack_size": "10 tablets",
        "price": 50.0,
        "product_type": "Medicine"
    }, headers=headers)
    assert response.status_code == 200, f"Failed to create test product: {response.text}"
    product_id = response.json()["id"]
    yield product_id
    # Cleanup: delete the test product
    requests.delete(f"{BASE_URL}/api/medicines/{product_id}", headers=headers)


class TestImageUploadEndpoint:
    """Tests for POST /api/products/{product_id}/image"""
    
    def test_upload_jpeg_image_success(self, ops_token, test_product_id):
        """Test successful JPEG image upload"""
        headers = {"Authorization": f"Bearer {ops_token}"}
        
        # Create a small valid JPEG image (1x1 pixel)
        jpeg_data = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
            0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
            0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
            0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
            0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
            0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
            0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
            0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
            0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
            0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
            0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
            0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
            0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
            0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
            0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
            0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
            0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
            0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
            0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
            0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
            0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
            0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xF1, 0x7E, 0xA9,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0xFF, 0xD9
        ])
        
        files = {"file": ("test_image.jpg", io.BytesIO(jpeg_data), "image/jpeg")}
        response = requests.post(
            f"{BASE_URL}/api/products/{test_product_id}/image",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 200, f"Image upload failed: {response.text}"
        data = response.json()
        assert "image_path" in data, "Response should contain image_path"
        assert data["image_path"].startswith("medilo/products/"), "image_path should start with medilo/products/"
        assert test_product_id in data["image_path"], "image_path should contain product_id"
        print(f"✓ JPEG image uploaded successfully: {data['image_path']}")
    
    def test_upload_png_image_success(self, ops_token, test_product_id):
        """Test successful PNG image upload"""
        headers = {"Authorization": f"Bearer {ops_token}"}
        
        # Create a minimal valid PNG image (1x1 pixel, red)
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 dimensions
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,  # 8-bit RGB
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,  # compressed data
            0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xDD,
            0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,  # IEND chunk
            0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {"file": ("test_image.png", io.BytesIO(png_data), "image/png")}
        response = requests.post(
            f"{BASE_URL}/api/products/{test_product_id}/image",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 200, f"PNG upload failed: {response.text}"
        data = response.json()
        assert "image_path" in data
        print(f"✓ PNG image uploaded successfully: {data['image_path']}")
    
    def test_reject_non_image_file(self, ops_token, test_product_id):
        """Test that non-image files are rejected"""
        headers = {"Authorization": f"Bearer {ops_token}"}
        
        # Create a text file
        text_data = b"This is not an image file"
        files = {"file": ("test.txt", io.BytesIO(text_data), "text/plain")}
        
        response = requests.post(
            f"{BASE_URL}/api/products/{test_product_id}/image",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400 for non-image file, got {response.status_code}"
        assert "image" in response.text.lower() or "allowed" in response.text.lower(), \
            f"Error message should mention image types: {response.text}"
        print(f"✓ Non-image file correctly rejected: {response.json()}")
    
    def test_reject_pdf_file(self, ops_token, test_product_id):
        """Test that PDF files are rejected"""
        headers = {"Authorization": f"Bearer {ops_token}"}
        
        # Create a minimal PDF file
        pdf_data = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
        files = {"file": ("test.pdf", io.BytesIO(pdf_data), "application/pdf")}
        
        response = requests.post(
            f"{BASE_URL}/api/products/{test_product_id}/image",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400 for PDF file, got {response.status_code}"
        print(f"✓ PDF file correctly rejected")
    
    def test_reject_oversized_file(self, ops_token, test_product_id):
        """Test that files > 5MB are rejected"""
        headers = {"Authorization": f"Bearer {ops_token}"}
        
        # Create a file larger than 5MB (5.1MB)
        large_data = b"x" * (5 * 1024 * 1024 + 100000)  # 5.1MB
        files = {"file": ("large_image.jpg", io.BytesIO(large_data), "image/jpeg")}
        
        response = requests.post(
            f"{BASE_URL}/api/products/{test_product_id}/image",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400 for oversized file, got {response.status_code}"
        assert "5mb" in response.text.lower() or "size" in response.text.lower(), \
            f"Error message should mention size limit: {response.text}"
        print(f"✓ Oversized file correctly rejected")
    
    def test_reject_non_ops_user(self, customer_token, test_product_id):
        """Test that non-ops users cannot upload images"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # Create a small valid image
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
            0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xDD,
            0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
            0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {"file": ("test_image.png", io.BytesIO(png_data), "image/png")}
        response = requests.post(
            f"{BASE_URL}/api/products/{test_product_id}/image",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 403, f"Expected 403 for non-ops user, got {response.status_code}"
        print(f"✓ Non-ops user correctly rejected with 403")
    
    def test_reject_unauthenticated_user(self, test_product_id):
        """Test that unauthenticated users cannot upload images"""
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
            0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xDD,
            0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
            0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {"file": ("test_image.png", io.BytesIO(png_data), "image/png")}
        response = requests.post(
            f"{BASE_URL}/api/products/{test_product_id}/image",
            files=files
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 for unauthenticated user, got {response.status_code}"
        print(f"✓ Unauthenticated user correctly rejected")
    
    def test_reject_nonexistent_product(self, ops_token):
        """Test that uploading to non-existent product returns 404"""
        headers = {"Authorization": f"Bearer {ops_token}"}
        
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
            0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xDD,
            0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
            0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {"file": ("test_image.png", io.BytesIO(png_data), "image/png")}
        response = requests.post(
            f"{BASE_URL}/api/products/nonexistent-product-id/image",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent product, got {response.status_code}"
        print(f"✓ Non-existent product correctly returns 404")


class TestFileServeEndpoint:
    """Tests for GET /api/files/{path}"""
    
    def test_serve_existing_image(self):
        """Test serving an existing uploaded image"""
        response = requests.get(f"{BASE_URL}/api/files/{PRODUCT_WITH_IMAGE_PATH}")
        
        assert response.status_code == 200, f"Failed to serve image: {response.status_code}"
        assert "image" in response.headers.get("Content-Type", "").lower(), \
            f"Content-Type should be image type, got: {response.headers.get('Content-Type')}"
        assert len(response.content) > 0, "Image content should not be empty"
        print(f"✓ Existing image served successfully with Content-Type: {response.headers.get('Content-Type')}")
    
    def test_serve_nonexistent_file_returns_404(self):
        """Test that non-existent file returns 404"""
        response = requests.get(f"{BASE_URL}/api/files/medilo/products/nonexistent/file.jpg")
        
        assert response.status_code == 404, f"Expected 404 for non-existent file, got {response.status_code}"
        print(f"✓ Non-existent file correctly returns 404")
    
    def test_file_serve_is_public(self):
        """Test that file serve endpoint is public (no auth required)"""
        # No auth header
        response = requests.get(f"{BASE_URL}/api/files/{PRODUCT_WITH_IMAGE_PATH}")
        
        assert response.status_code == 200, f"File serve should be public, got {response.status_code}"
        print(f"✓ File serve endpoint is public (no auth required)")


class TestMedicinesEndpointImagePath:
    """Tests for GET /api/medicines - image_path field"""
    
    def test_medicines_include_image_path_field(self):
        """Test that medicines response includes image_path field"""
        response = requests.get(f"{BASE_URL}/api/medicines")
        
        assert response.status_code == 200
        medicines = response.json()
        assert len(medicines) > 0, "Should have at least one medicine"
        
        # Check that all medicines have image_path field (can be null)
        for med in medicines:
            assert "image_path" in med, f"Medicine {med.get('name')} missing image_path field"
        
        print(f"✓ All {len(medicines)} medicines have image_path field")
    
    def test_product_with_image_has_valid_path(self):
        """Test that product with uploaded image has valid image_path"""
        response = requests.get(f"{BASE_URL}/api/medicines/{PRODUCT_WITH_IMAGE_ID}")
        
        assert response.status_code == 200
        medicine = response.json()
        
        assert medicine["image_path"] is not None, "Dolo 650 should have image_path"
        assert medicine["image_path"].startswith("medilo/products/"), \
            f"image_path should start with medilo/products/, got: {medicine['image_path']}"
        print(f"✓ Product with image has valid path: {medicine['image_path']}")
    
    def test_product_without_image_has_null_path(self):
        """Test that product without image has null image_path"""
        response = requests.get(f"{BASE_URL}/api/medicines")
        
        assert response.status_code == 200
        medicines = response.json()
        
        # Find a product without image
        product_without_image = next((m for m in medicines if m["image_path"] is None), None)
        assert product_without_image is not None, "Should have at least one product without image"
        
        print(f"✓ Product without image has null path: {product_without_image['name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
