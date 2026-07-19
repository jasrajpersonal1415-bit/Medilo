from enum import Enum
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional


# Enums
class UserRole(str, Enum):
    CUSTOMER = "customer"
    PHARMACY_STAFF = "pharmacy_staff"
    PHARMACIST = "pharmacist"
    OPS = "ops"
    DELIVERY_PARTNER = "delivery_partner"

class MedicineBucket(str, Enum):
    OTC = "OTC"  # Bucket A - Green
    SCHEDULE_H = "SCHEDULE_H"  # Bucket B - Yellow
    SCHEDULE_H1 = "SCHEDULE_H1"  # Bucket C - Red

class ProductType(str, Enum):
    MEDICINE = "Medicine"
    WELLNESS = "Wellness"
    BEAUTY_PERSONAL_CARE = "Beauty & Personal Care"
    BABY_CARE = "Baby Care"
    DEVICE = "Device"

class OrderStatus(str, Enum):
    PENDING_PHARMACIST_REVIEW = "pending_pharmacist_review"
    PHARMACIST_APPROVED = "pharmacist_approved"
    PHARMACIST_REJECTED = "pharmacist_rejected"
    PRESCRIPTION_REQUESTED = "prescription_requested"
    ASSIGNED_TO_PHARMACY = "assigned_to_pharmacy"
    PHARMACY_ACCEPTED = "pharmacy_accepted"
    PHARMACY_REJECTED = "pharmacy_rejected"
    INVENTORY_CONFIRMED = "inventory_confirmed"
    PREPARING = "preparing"
    READY_FOR_PICKUP = "ready_for_pickup"
    PICKED_UP = "picked_up"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

# Pydantic Models
class UserBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

class CustomerCreate(BaseModel):
    phone: str
    name: str

class CustomerLogin(BaseModel):
    phone: str

class StaffCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole
    pharmacy_id: Optional[str] = None

class StaffLogin(BaseModel):
    email: EmailStr
    password: str

class DeliveryPartnerCreate(BaseModel):
    phone: str
    name: str

class UserResponse(BaseModel):
    id: str
    name: str
    role: UserRole
    phone: Optional[str] = None
    email: Optional[str] = None
    pharmacy_id: Optional[str] = None
    is_active: bool = True
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class MedicineCreate(BaseModel):
    name: str
    generic_name: str
    manufacturer: str
    bucket: Optional[MedicineBucket] = None  # Only required for Medicine type
    strength: Optional[str] = ""
    form: str  # tablet, capsule, syrup, cream, device, etc.
    pack_size: str  # e.g., "10 tablets", "100ml"
    price: float  # MEDILO-controlled price (MRP)
    product_type: ProductType = ProductType.MEDICINE  # Medicine, Wellness, Beauty, Device
    description: Optional[str] = None
    batch: Optional[str] = None
    expiry_date: Optional[str] = None
    quantity: Optional[int] = None
    purchase_price: Optional[float] = None
    image_path: Optional[str] = None

class MedicineResponse(BaseModel):
    id: str
    name: str
    generic_name: str
    manufacturer: str
    bucket: Optional[MedicineBucket] = None  # Only for Medicine type
    strength: Optional[str] = ""
    form: str
    pack_size: Optional[str] = ""  # Optional for backward compatibility
    price: Optional[float] = 0.0  # Optional for backward compatibility - MEDILO controlled
    product_type: Optional[ProductType] = ProductType.MEDICINE  # Default for backward compatibility
    description: Optional[str] = None
    is_active: bool = True
    created_at: str
    batch: Optional[str] = None
    expiry_date: Optional[str] = None
    quantity: Optional[int] = None
    purchase_price: Optional[float] = None
    image_path: Optional[str] = None

class PharmacyCreate(BaseModel):
    name: str
    license_number: str
    address: str
    city: str
    pincode: str
    phone: str
    email: EmailStr
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class PharmacyResponse(BaseModel):
    id: str
    name: str
    license_number: str
    address: str
    city: str
    pincode: str
    phone: str
    email: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: bool = True
    created_at: str

class OrderItemCreate(BaseModel):
    medicine_id: str
    quantity: int

class OrderItem(BaseModel):
    medicine_id: str
    medicine_name: str
    medicine_bucket: Optional[MedicineBucket] = None  # Only for Medicine type
    product_type: Optional[ProductType] = ProductType.MEDICINE  # Product category
    medicine_strength: Optional[str] = ""  # Optional for backward compatibility
    medicine_pack_size: Optional[str] = ""  # Optional for backward compatibility
    quantity: int
    unit_price: Optional[float] = 0.0  # MEDILO-controlled price from medicine master
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None

class OrderCreate(BaseModel):
    items: List[OrderItemCreate]
    prescription_image: Optional[str] = None  # base64 encoded
    schedule_h_declaration: bool = False
    delivery_address: str
    latitude: float
    longitude: float

class OrderResponse(BaseModel):
    id: str
    customer_id: str
    customer_phone: str
    customer_name: str
    items: List[OrderItem]
    status: OrderStatus
    prescription_image: Optional[str] = None
    schedule_h_declaration: bool = False
    delivery_address: str
    latitude: float
    longitude: float
    pharmacy_id: Optional[str] = None
    pharmacy_name: Optional[str] = None
    pharmacy_address: Optional[str] = None
    pharmacy_latitude: Optional[float] = None
    pharmacy_longitude: Optional[float] = None
    pharmacist_id: Optional[str] = None
    pharmacist_notes: Optional[str] = None
    delivery_partner_id: Optional[str] = None
    delivery_partner_name: Optional[str] = None
    rejection_reason: Optional[str] = None
    total_amount: Optional[float] = None
    subtotal: Optional[float] = None
    category_discount: Optional[float] = None
    cart_discount: Optional[float] = None
    total_savings: Optional[float] = None
    invoice_generated: bool = False
    created_at: str
    updated_at: str

# Delivery Partner specific models
class DeliveryOrderResponse(BaseModel):
    """Limited order view for delivery partners - no medicine details or prices"""
    id: str
    customer_phone: str
    customer_name: str
    status: OrderStatus
    delivery_address: str
    latitude: float
    longitude: float
    pharmacy_name: Optional[str] = None
    pharmacy_address: Optional[str] = None
    pharmacy_phone: Optional[str] = None
    pharmacy_latitude: Optional[float] = None
    pharmacy_longitude: Optional[float] = None
    item_count: int
    delivery_partner_id: Optional[str] = None  # Added for frontend to identify assigned orders
    created_at: str
    updated_at: str

class DeliveryPartnerLogin(BaseModel):
    phone: str

class DeliveryAction(BaseModel):
    action: str  # pickup, out_for_delivery, delivered

class DeliveryIssueReport(BaseModel):
    issue_type: str  # customer_unavailable, wrong_address, pharmacy_issue, other
    description: str

class PharmacistAction(BaseModel):
    action: str  # approve, reject, request_prescription
    notes: Optional[str] = None

class PharmacyAction(BaseModel):
    action: str  # accept, reject, mark_preparing, mark_ready
    rejection_reason: Optional[str] = None

class InventoryConfirmation(BaseModel):
    """Pharmacy confirms batch & expiry only - NO price input"""
    items: List[dict]  # Each item has medicine_id, batch_number, expiry_date

class AuditLogResponse(BaseModel):
    id: str
    action: str
    entity_type: str
    entity_id: str
    user_id: str
    user_role: UserRole
    details: Optional[dict] = None
    timestamp: str
