from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from enum import Enum
import io
import csv
import base64
import requests as http_requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Object Storage Configuration
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "medilo"
storage_key = None

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = http_requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = http_requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = http_requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'medilo-pilot-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="MEDILO Healthcare API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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

# Helper Functions
def generate_id():
    return str(uuid.uuid4())

def get_utc_now():
    return datetime.now(timezone.utc).isoformat()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, role: str, pharmacy_id: str = None) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "pharmacy_id": pharmacy_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="User account is deactivated")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_role(required_roles: List[UserRole]):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in [r.value for r in required_roles]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

async def log_audit(action: str, entity_type: str, entity_id: str, user_id: str, user_role: str, details: dict = None):
    audit_log = {
        "id": generate_id(),
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "user_id": user_id,
        "user_role": user_role,
        "details": details,
        "timestamp": get_utc_now()
    }
    await db.audit_logs.insert_one(audit_log)
    logger.info(f"AUDIT: {action} on {entity_type}:{entity_id} by {user_role}:{user_id}")

# Auth Routes
@api_router.post("/auth/customer/register", response_model=TokenResponse)
async def register_customer(data: CustomerCreate):
    # Check if phone already exists
    existing = await db.users.find_one({"phone": data.phone})
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    user = {
        "id": generate_id(),
        "phone": data.phone,
        "name": data.name,
        "role": UserRole.CUSTOMER.value,
        "is_active": True,
        "created_at": get_utc_now()
    }
    await db.users.insert_one(user)
    await log_audit("customer_registered", "user", user["id"], user["id"], user["role"])
    
    token = create_token(user["id"], user["role"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(**{k: v for k, v in user.items() if k != "_id"})
    )

@api_router.post("/auth/customer/login", response_model=TokenResponse)
async def login_customer(data: CustomerLogin):
    user = await db.users.find_one({"phone": data.phone, "role": UserRole.CUSTOMER.value}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Phone number not registered")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")
    
    await log_audit("customer_login", "user", user["id"], user["id"], user["role"])
    token = create_token(user["id"], user["role"])
    return TokenResponse(access_token=token, user=UserResponse(**user))

@api_router.post("/auth/staff/register", response_model=TokenResponse)
async def register_staff(data: StaffCreate):
    if data.role == UserRole.CUSTOMER:
        raise HTTPException(status_code=400, detail="Use customer registration endpoint")
    
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = {
        "id": generate_id(),
        "email": data.email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": data.role.value,
        "pharmacy_id": data.pharmacy_id,
        "is_active": True,
        "created_at": get_utc_now()
    }
    await db.users.insert_one(user)
    await log_audit("staff_registered", "user", user["id"], user["id"], user["role"])
    
    token = create_token(user["id"], user["role"], user.get("pharmacy_id"))
    user_response = {k: v for k, v in user.items() if k not in ["_id", "password_hash"]}
    return TokenResponse(access_token=token, user=UserResponse(**user_response))

@api_router.post("/auth/staff/login", response_model=TokenResponse)
async def login_staff(data: StaffLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or user.get("role") == UserRole.CUSTOMER.value:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")
    
    await log_audit("staff_login", "user", user["id"], user["id"], user["role"])
    token = create_token(user["id"], user["role"], user.get("pharmacy_id"))
    user_response = {k: v for k, v in user.items() if k != "password_hash"}
    return TokenResponse(access_token=token, user=UserResponse(**user_response))

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(**{k: v for k, v in user.items() if k != "password_hash"})

# Medicine Routes
@api_router.post("/medicines", response_model=MedicineResponse)
async def create_medicine(data: MedicineCreate, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.OPS.value, UserRole.PHARMACIST.value]:
        raise HTTPException(status_code=403, detail="Only ops or pharmacist can add medicines")
    
    medicine = {
        "id": generate_id(),
        **data.model_dump(),
        "bucket": data.bucket.value if data.bucket else None,
        "product_type": data.product_type.value,
        "is_active": True,
        "created_at": get_utc_now()
    }
    await db.medicines.insert_one(medicine)
    await log_audit("medicine_created", "medicine", medicine["id"], user["id"], user["role"], {"name": data.name, "product_type": data.product_type.value})
    return MedicineResponse(**{k: v for k, v in medicine.items() if k != "_id"})

@api_router.get("/medicines", response_model=List[MedicineResponse])
async def get_medicines(search: str = None, bucket: MedicineBucket = None, product_type: ProductType = None):
    query = {"is_active": True}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"generic_name": {"$regex": search, "$options": "i"}}
        ]
    if bucket:
        query["bucket"] = bucket.value
    if product_type:
        query["product_type"] = product_type.value
    
    medicines = await db.medicines.find(query, {"_id": 0}).to_list(1000)
    return [MedicineResponse(**m) for m in medicines]

@api_router.get("/categories", response_model=List[dict])
async def get_categories():
    """Get product counts by category for homepage display"""
    categories = [
        {"id": "Medicine", "name": "Medicines", "icon": "pill", "description": "Prescription & OTC medicines"},
        {"id": "Beauty & Personal Care", "name": "Beauty & Personal Care", "icon": "sparkles", "description": "Skincare & personal care"},
        {"id": "Wellness", "name": "Wellness", "icon": "heart", "description": "Health supplements & wellness"},
        {"id": "Baby Care", "name": "Baby Care", "icon": "baby", "description": "Baby health & care essentials"},
        {"id": "Device", "name": "Medical Devices", "icon": "activity", "description": "Health monitoring devices"},
    ]
    
    # Get counts for each category
    for cat in categories:
        count = await db.medicines.count_documents({"product_type": cat["id"], "is_active": True})
        cat["count"] = count
    
    return categories

@api_router.get("/medicines/{medicine_id}", response_model=MedicineResponse)
async def get_medicine(medicine_id: str):
    medicine = await db.medicines.find_one({"id": medicine_id}, {"_id": 0})
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return MedicineResponse(**medicine)

@api_router.put("/medicines/{medicine_id}", response_model=MedicineResponse)
async def update_medicine(medicine_id: str, data: MedicineCreate, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.OPS.value, UserRole.PHARMACIST.value]:
        raise HTTPException(status_code=403, detail="Only ops or pharmacist can update medicines")
    
    update_data = data.model_dump()
    update_data["bucket"] = data.bucket.value if data.bucket else None
    update_data["product_type"] = data.product_type.value
    
    result = await db.medicines.update_one(
        {"id": medicine_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    
    await log_audit("medicine_updated", "medicine", medicine_id, user["id"], user["role"])
    medicine = await db.medicines.find_one({"id": medicine_id}, {"_id": 0})
    return MedicineResponse(**medicine)

@api_router.delete("/medicines/{medicine_id}")
async def delete_medicine(medicine_id: str, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.OPS.value]:
        raise HTTPException(status_code=403, detail="Only ops can delete medicines")
    
    result = await db.medicines.update_one(
        {"id": medicine_id},
        {"$set": {"is_active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    
    await log_audit("medicine_deleted", "medicine", medicine_id, user["id"], user["role"])
    return {"message": "Medicine deactivated"}

# Product Image Upload
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB

@api_router.post("/products/{product_id}/image")
async def upload_product_image(
    product_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can upload product images")
    
    product = await db.medicines.find_one({"id": product_id, "is_active": True}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, and GIF images are allowed")
    
    data = await file.read()
    if len(data) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image must be less than 5MB")
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    path = f"{APP_NAME}/products/{product_id}/{uuid.uuid4()}.{ext}"
    
    result = put_object(path, data, file.content_type)
    
    await db.medicines.update_one(
        {"id": product_id},
        {"$set": {"image_path": result["path"]}}
    )
    
    await log_audit("product_image_uploaded", "medicine", product_id, user["id"], user["role"])
    
    return {"image_path": result["path"]}

@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    try:
        data, content_type = get_object(path)
        return Response(content=data, media_type=content_type)
    except Exception as e:
        raise HTTPException(status_code=404, detail="File not found")

# CSV Import Routes
VALID_CATEGORIES = {"Medicine": "Medicine", "Wellness": "Wellness", "Beauty": "Beauty & Personal Care", "Device": "Device",
                    "medicine": "Medicine", "wellness": "Wellness", "beauty": "Beauty & Personal Care", "device": "Device",
                    "OTC & Wellness": "Wellness", "Beauty & Personal Care": "Beauty & Personal Care", "Medical Devices": "Device",
                    "Baby Care": "Baby Care", "baby care": "Baby Care", "BabyCare": "Baby Care"}
VALID_BUCKETS = {"OTC": "OTC", "SCHEDULE_H": "SCHEDULE_H", "SCHEDULE_H1": "SCHEDULE_H1",
                 "otc": "OTC", "Schedule H": "SCHEDULE_H", "Schedule H1": "SCHEDULE_H1",
                 "schedule_h": "SCHEDULE_H", "schedule_h1": "SCHEDULE_H1"}

def parse_csv_row(row, row_num):
    """Parse and validate a single CSV row. Returns (parsed_data, errors)."""
    errors = []
    
    name = (row.get("Product Name") or row.get("product_name") or "").strip()
    if not name:
        errors.append(f"Row {row_num}: Product Name is required")
    
    category_raw = (row.get("Category") or row.get("category") or "").strip()
    category = VALID_CATEGORIES.get(category_raw)
    if not category:
        errors.append(f"Row {row_num}: Invalid Category '{category_raw}'. Must be Medicine, Wellness, Beauty & Personal Care, Baby Care, or Device")
    
    type_raw = (row.get("Type") or row.get("type") or "").strip()
    bucket = None
    if category == "Medicine":
        bucket = VALID_BUCKETS.get(type_raw)
        if not bucket:
            errors.append(f"Row {row_num}: Invalid Type '{type_raw}' for Medicine. Must be OTC, SCHEDULE_H, or SCHEDULE_H1")
    
    batch = (row.get("Batch") or row.get("batch") or "").strip()
    if not batch:
        errors.append(f"Row {row_num}: Batch is required")
    
    expiry_raw = (row.get("Expiry Date") or row.get("expiry_date") or "").strip()
    expiry_date = None
    if not expiry_raw:
        errors.append(f"Row {row_num}: Expiry Date is required")
    else:
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
            try:
                parsed = datetime.strptime(expiry_raw, fmt)
                expiry_date = parsed.strftime("%Y-%m-%d")
                break
            except ValueError:
                continue
        if not expiry_date:
            errors.append(f"Row {row_num}: Invalid Expiry Date '{expiry_raw}'. Use YYYY-MM-DD or DD-MM-YYYY")
    
    quantity_raw = (row.get("Quantity") or row.get("quantity") or "").strip()
    quantity = None
    if not quantity_raw:
        errors.append(f"Row {row_num}: Quantity is required")
    else:
        try:
            quantity = int(quantity_raw)
            if quantity < 0:
                errors.append(f"Row {row_num}: Quantity must be non-negative")
        except ValueError:
            errors.append(f"Row {row_num}: Invalid Quantity '{quantity_raw}'")
    
    mrp_raw = (row.get("MRP") or row.get("mrp") or "").strip()
    mrp = None
    if not mrp_raw:
        errors.append(f"Row {row_num}: MRP is required")
    else:
        try:
            mrp = float(mrp_raw)
            if mrp < 0:
                errors.append(f"Row {row_num}: MRP must be non-negative")
        except ValueError:
            errors.append(f"Row {row_num}: Invalid MRP '{mrp_raw}'")
    
    pp_raw = (row.get("Purchase Price") or row.get("purchase_price") or "").strip()
    purchase_price = None
    if not pp_raw:
        errors.append(f"Row {row_num}: Purchase Price is required")
    else:
        try:
            purchase_price = float(pp_raw)
            if purchase_price < 0:
                errors.append(f"Row {row_num}: Purchase Price must be non-negative")
        except ValueError:
            errors.append(f"Row {row_num}: Invalid Purchase Price '{pp_raw}'")
    
    manufacturer = (row.get("Manufacturer") or row.get("manufacturer") or "").strip()
    if not manufacturer:
        errors.append(f"Row {row_num}: Manufacturer is required")
    
    parsed = {
        "name": name,
        "product_type": category,
        "bucket": bucket,
        "batch": batch,
        "expiry_date": expiry_date,
        "quantity": quantity,
        "price": mrp,
        "purchase_price": purchase_price,
        "manufacturer": manufacturer,
        "row_num": row_num,
    }
    return parsed, errors

@api_router.post("/ops/products/import/validate")
async def validate_csv_import(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can import products")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="Unable to decode file. Use UTF-8 encoding.")
    
    reader = csv.DictReader(io.StringIO(text))
    required_headers = {"Product Name", "Category", "Type", "Batch", "Expiry Date", "Quantity", "MRP", "Purchase Price", "Manufacturer"}
    actual_headers = set(reader.fieldnames or [])
    missing = required_headers - actual_headers
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(sorted(missing))}")
    
    rows = []
    all_errors = []
    for i, row in enumerate(reader, start=2):
        if i > 10002:
            all_errors.append(f"File exceeds 10,000 row limit")
            break
        parsed, errs = parse_csv_row(row, i)
        all_errors.extend(errs)
        rows.append(parsed)
    
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty (no data rows)")
    
    # Check for duplicates within CSV
    seen = {}
    duplicates_in_csv = []
    for r in rows:
        key = (r["name"].lower(), r["batch"].lower()) if r["name"] and r["batch"] else None
        if key:
            if key in seen:
                duplicates_in_csv.append(f"Row {r['row_num']}: Duplicate of row {seen[key]} ({r['name']} + {r['batch']})")
            else:
                seen[key] = r["row_num"]
    
    # Check duplicates against DB
    existing_matches = []
    new_entries = []
    update_entries = []
    for r in rows:
        if r["name"] and r["batch"]:
            existing = await db.medicines.find_one(
                {"name": {"$regex": f"^{r['name']}$", "$options": "i"}, "batch": r["batch"], "is_active": True},
                {"_id": 0, "id": 1, "name": 1, "batch": 1, "quantity": 1}
            )
            if existing:
                update_entries.append({**r, "existing_id": existing["id"], "existing_quantity": existing.get("quantity", 0)})
            else:
                new_entries.append(r)
        else:
            new_entries.append(r)
    
    # Sort by expiry date
    def sort_key(x):
        try:
            return x.get("expiry_date") or "9999-99-99"
        except:
            return "9999-99-99"
    
    rows_sorted = sorted(rows, key=sort_key)
    
    return {
        "total_rows": len(rows),
        "valid_rows": len(rows) - len([e for e in all_errors if e]),
        "errors": all_errors,
        "duplicates_in_csv": duplicates_in_csv,
        "new_entries": len(new_entries),
        "update_entries": len(update_entries),
        "preview": rows_sorted[:100],
        "all_data": rows_sorted,
        "has_errors": len(all_errors) > 0
    }

@api_router.post("/ops/products/import/confirm")
async def confirm_csv_import(data: dict, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can import products")
    
    rows = data.get("rows", [])
    if not rows:
        raise HTTPException(status_code=400, detail="No data to import")
    
    created = 0
    updated = 0
    errors = []
    
    for r in rows:
        try:
            name = r.get("name", "").strip()
            batch = r.get("batch", "").strip()
            if not name or not batch:
                continue
            
            # Check if exists
            existing = await db.medicines.find_one(
                {"name": {"$regex": f"^{name}$", "$options": "i"}, "batch": batch, "is_active": True},
                {"_id": 0}
            )
            
            if existing:
                # Update quantity (add to existing)
                new_qty = (existing.get("quantity") or 0) + (r.get("quantity") or 0)
                update_fields = {"quantity": new_qty}
                if r.get("price") is not None:
                    update_fields["price"] = r["price"]
                if r.get("purchase_price") is not None:
                    update_fields["purchase_price"] = r["purchase_price"]
                if r.get("expiry_date"):
                    update_fields["expiry_date"] = r["expiry_date"]
                
                await db.medicines.update_one({"id": existing["id"]}, {"$set": update_fields})
                updated += 1
            else:
                # Create new entry
                medicine = {
                    "id": generate_id(),
                    "name": name,
                    "generic_name": name,
                    "manufacturer": r.get("manufacturer", ""),
                    "bucket": r.get("bucket"),
                    "product_type": r.get("product_type", "Medicine"),
                    "strength": "",
                    "form": "tablet",
                    "pack_size": "",
                    "price": r.get("price", 0),
                    "purchase_price": r.get("purchase_price"),
                    "batch": batch,
                    "expiry_date": r.get("expiry_date"),
                    "quantity": r.get("quantity", 0),
                    "description": None,
                    "is_active": True,
                    "created_at": get_utc_now()
                }
                await db.medicines.insert_one(medicine)
                created += 1
        except Exception as e:
            errors.append(f"Error processing {r.get('name', 'unknown')}: {str(e)}")
    
    await log_audit("csv_import", "medicine", "bulk", user["id"], user["role"],
                    {"created": created, "updated": updated, "total": len(rows)})
    
    return {
        "created": created,
        "updated": updated,
        "errors": errors,
        "total_processed": created + updated
    }

# Pharmacy Routes
@api_router.post("/pharmacies", response_model=PharmacyResponse)
async def create_pharmacy(data: PharmacyCreate, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.OPS.value]:
        raise HTTPException(status_code=403, detail="Only ops can add pharmacies")
    
    pharmacy = {
        "id": generate_id(),
        **data.model_dump(),
        "is_active": True,
        "created_at": get_utc_now()
    }
    await db.pharmacies.insert_one(pharmacy)
    await log_audit("pharmacy_created", "pharmacy", pharmacy["id"], user["id"], user["role"], {"name": data.name})
    return PharmacyResponse(**{k: v for k, v in pharmacy.items() if k != "_id"})

@api_router.get("/pharmacies", response_model=List[PharmacyResponse])
async def get_pharmacies(user: dict = Depends(get_current_user)):
    pharmacies = await db.pharmacies.find({"is_active": True}, {"_id": 0}).to_list(100)
    return [PharmacyResponse(**p) for p in pharmacies]

@api_router.get("/pharmacies/{pharmacy_id}", response_model=PharmacyResponse)
async def get_pharmacy(pharmacy_id: str):
    pharmacy = await db.pharmacies.find_one({"id": pharmacy_id}, {"_id": 0})
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    return PharmacyResponse(**pharmacy)

@api_router.put("/pharmacies/{pharmacy_id}", response_model=PharmacyResponse)
async def update_pharmacy(pharmacy_id: str, data: PharmacyCreate, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.OPS.value]:
        raise HTTPException(status_code=403, detail="Only ops can update pharmacies")
    
    result = await db.pharmacies.update_one(
        {"id": pharmacy_id},
        {"$set": data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    
    await log_audit("pharmacy_updated", "pharmacy", pharmacy_id, user["id"], user["role"])
    pharmacy = await db.pharmacies.find_one({"id": pharmacy_id}, {"_id": 0})
    return PharmacyResponse(**pharmacy)

# Order Routes
@api_router.post("/orders", response_model=OrderResponse)
async def create_order(data: OrderCreate, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Only customers can create orders")
    
    # Validate items and determine highest bucket (only for medicines)
    items = []
    total_amount = 0.0  # Calculate from MEDILO price master
    highest_bucket = None  # None means no medicines requiring review
    bucket_priority = {MedicineBucket.OTC: 0, MedicineBucket.SCHEDULE_H: 1, MedicineBucket.SCHEDULE_H1: 2}
    has_medicines_requiring_review = False
    
    for item in data.items:
        medicine = await db.medicines.find_one({"id": item.medicine_id, "is_active": True}, {"_id": 0})
        if not medicine:
            raise HTTPException(status_code=400, detail=f"Product {item.medicine_id} not found")
        
        # Get MEDILO-controlled price from medicine master
        unit_price = medicine.get("price", 0)
        product_type = medicine.get("product_type", ProductType.MEDICINE.value)
        
        order_item = OrderItem(
            medicine_id=item.medicine_id,
            medicine_name=medicine["name"],
            medicine_bucket=medicine.get("bucket"),  # May be None for non-medicines
            product_type=product_type,
            medicine_strength=medicine.get("strength", ""),
            medicine_pack_size=medicine.get("pack_size", ""),
            quantity=item.quantity,
            unit_price=unit_price
        )
        items.append(order_item.model_dump())
        total_amount += unit_price * item.quantity
        
        # Only check bucket for Medicine type products
        if product_type == ProductType.MEDICINE.value and medicine.get("bucket"):
            med_bucket = MedicineBucket(medicine["bucket"])
            if highest_bucket is None or bucket_priority[med_bucket] > bucket_priority[highest_bucket]:
                highest_bucket = med_bucket
            if med_bucket in [MedicineBucket.SCHEDULE_H, MedicineBucket.SCHEDULE_H1]:
                has_medicines_requiring_review = True
    
    # Validate prescription requirements (only for medicines)
    if highest_bucket == MedicineBucket.SCHEDULE_H1 and not data.prescription_image:
        raise HTTPException(status_code=400, detail="Prescription upload is mandatory for Schedule H1 medicines")
    
    if highest_bucket == MedicineBucket.SCHEDULE_H and not data.prescription_image and not data.schedule_h_declaration:
        raise HTTPException(status_code=400, detail="Either prescription upload or declaration is required for Schedule H medicines")
    
    # Determine initial status based on whether order has medicines requiring pharmacist review
    if has_medicines_requiring_review:
        initial_status = OrderStatus.PENDING_PHARMACIST_REVIEW
    else:
        initial_status = OrderStatus.PHARMACIST_APPROVED  # No pharmacist review needed
    
    order = {
        "id": generate_id(),
        "customer_id": user["id"],
        "customer_phone": user["phone"],
        "customer_name": user["name"],
        "items": items,
        "status": initial_status.value,
        "prescription_image": data.prescription_image,
        "schedule_h_declaration": data.schedule_h_declaration,
        "delivery_address": data.delivery_address,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "highest_bucket": highest_bucket.value if highest_bucket else None,
        "pharmacy_id": None,
        "pharmacy_name": None,
        "pharmacy_address": None,
        "pharmacy_latitude": None,
        "pharmacy_longitude": None,
        "pharmacist_id": None,
        "pharmacist_notes": None,
        "delivery_partner_id": None,
        "delivery_partner_name": None,
        "rejection_reason": None,
        "total_amount": total_amount,  # Price calculated from MEDILO master
        "invoice_generated": False,
        "created_at": get_utc_now(),
        "updated_at": get_utc_now()
    }
    
    await db.orders.insert_one(order)
    await log_audit("order_created", "order", order["id"], user["id"], user["role"], {"status": initial_status.value, "total_amount": total_amount})
    
    return OrderResponse(**{k: v for k, v in order.items() if k not in ["_id", "highest_bucket"]})

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_orders(user: dict = Depends(get_current_user)):
    if user["role"] == UserRole.CUSTOMER.value:
        query = {"customer_id": user["id"]}
    elif user["role"] == UserRole.PHARMACY_STAFF.value:
        query = {"pharmacy_id": user.get("pharmacy_id")}
    else:
        query = {}
    
    orders = await db.orders.find(query, {"_id": 0, "highest_bucket": 0}).sort("created_at", -1).to_list(1000)
    return [OrderResponse(**o) for o in orders]

@api_router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0, "highest_bucket": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check access
    if user["role"] == UserRole.CUSTOMER.value and order["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] == UserRole.PHARMACY_STAFF.value and order.get("pharmacy_id") != user.get("pharmacy_id"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return OrderResponse(**order)

# Pharmacist Routes
@api_router.get("/pharmacist/orders", response_model=List[OrderResponse])
async def get_pharmacist_orders(status: OrderStatus = None, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.PHARMACIST.value:
        raise HTTPException(status_code=403, detail="Only pharmacists can access this")
    
    query = {}
    if status:
        query["status"] = status.value
    else:
        # Default: show pending orders
        query["status"] = {"$in": [
            OrderStatus.PENDING_PHARMACIST_REVIEW.value,
            OrderStatus.PHARMACIST_APPROVED.value
        ]}
    
    orders = await db.orders.find(query, {"_id": 0, "highest_bucket": 0}).sort("created_at", 1).to_list(1000)
    return [OrderResponse(**o) for o in orders]

@api_router.post("/pharmacist/orders/{order_id}/action", response_model=OrderResponse)
async def pharmacist_action(order_id: str, data: PharmacistAction, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.PHARMACIST.value:
        raise HTTPException(status_code=403, detail="Only pharmacists can perform this action")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] not in [OrderStatus.PENDING_PHARMACIST_REVIEW.value, OrderStatus.PRESCRIPTION_REQUESTED.value]:
        raise HTTPException(status_code=400, detail="Order is not pending pharmacist review")
    
    update_data = {
        "pharmacist_id": user["id"],
        "pharmacist_notes": data.notes,
        "updated_at": get_utc_now()
    }
    
    if data.action == "approve":
        update_data["status"] = OrderStatus.PHARMACIST_APPROVED.value
    elif data.action == "reject":
        update_data["status"] = OrderStatus.PHARMACIST_REJECTED.value
        update_data["rejection_reason"] = data.notes
    elif data.action == "request_prescription":
        update_data["status"] = OrderStatus.PRESCRIPTION_REQUESTED.value
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_audit(f"pharmacist_{data.action}", "order", order_id, user["id"], user["role"], {"notes": data.notes})
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0, "highest_bucket": 0})
    return OrderResponse(**order)

@api_router.post("/pharmacist/orders/{order_id}/assign", response_model=OrderResponse)
async def assign_pharmacy(order_id: str, pharmacy_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.PHARMACIST.value:
        raise HTTPException(status_code=403, detail="Only pharmacists can assign pharmacies")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] != OrderStatus.PHARMACIST_APPROVED.value:
        raise HTTPException(status_code=400, detail="Order must be approved before assignment")
    
    pharmacy = await db.pharmacies.find_one({"id": pharmacy_id, "is_active": True}, {"_id": 0})
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    
    update_data = {
        "pharmacy_id": pharmacy_id,
        "pharmacy_name": pharmacy["name"],
        "pharmacy_address": pharmacy.get("address"),
        "pharmacy_latitude": pharmacy.get("latitude"),
        "pharmacy_longitude": pharmacy.get("longitude"),
        "status": OrderStatus.ASSIGNED_TO_PHARMACY.value,
        "updated_at": get_utc_now()
    }
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_audit("pharmacy_assigned", "order", order_id, user["id"], user["role"], {"pharmacy_id": pharmacy_id})
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0, "highest_bucket": 0})
    return OrderResponse(**order)

# Pharmacy Staff Routes
@api_router.get("/pharmacy/orders", response_model=List[OrderResponse])
async def get_pharmacy_orders(user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.PHARMACY_STAFF.value:
        raise HTTPException(status_code=403, detail="Only pharmacy staff can access this")
    
    if not user.get("pharmacy_id"):
        raise HTTPException(status_code=400, detail="User not linked to a pharmacy")
    
    orders = await db.orders.find(
        {"pharmacy_id": user["pharmacy_id"]},
        {"_id": 0, "highest_bucket": 0}
    ).sort("created_at", -1).to_list(1000)
    return [OrderResponse(**o) for o in orders]

@api_router.post("/pharmacy/orders/{order_id}/action", response_model=OrderResponse)
async def pharmacy_action(order_id: str, data: PharmacyAction, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.PHARMACY_STAFF.value:
        raise HTTPException(status_code=403, detail="Only pharmacy staff can perform this action")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("pharmacy_id") != user.get("pharmacy_id"):
        raise HTTPException(status_code=403, detail="Order not assigned to your pharmacy")
    
    update_data = {"updated_at": get_utc_now()}
    
    if data.action == "accept":
        if order["status"] != OrderStatus.ASSIGNED_TO_PHARMACY.value:
            raise HTTPException(status_code=400, detail="Invalid order status for this action")
        update_data["status"] = OrderStatus.PHARMACY_ACCEPTED.value
    elif data.action == "reject":
        if order["status"] != OrderStatus.ASSIGNED_TO_PHARMACY.value:
            raise HTTPException(status_code=400, detail="Invalid order status for this action")
        update_data["status"] = OrderStatus.PHARMACY_REJECTED.value
        update_data["rejection_reason"] = data.rejection_reason
    elif data.action == "mark_preparing":
        if order["status"] != OrderStatus.INVENTORY_CONFIRMED.value:
            raise HTTPException(status_code=400, detail="Inventory must be confirmed first")
        update_data["status"] = OrderStatus.PREPARING.value
    elif data.action == "mark_ready":
        if order["status"] != OrderStatus.PREPARING.value:
            raise HTTPException(status_code=400, detail="Order must be preparing first")
        update_data["status"] = OrderStatus.READY_FOR_PICKUP.value
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_audit(f"pharmacy_{data.action}", "order", order_id, user["id"], user["role"])
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0, "highest_bucket": 0})
    return OrderResponse(**order)

@api_router.post("/pharmacy/orders/{order_id}/confirm-inventory", response_model=OrderResponse)
async def confirm_inventory(order_id: str, data: InventoryConfirmation, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.PHARMACY_STAFF.value:
        raise HTTPException(status_code=403, detail="Only pharmacy staff can confirm inventory")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("pharmacy_id") != user.get("pharmacy_id"):
        raise HTTPException(status_code=403, detail="Order not assigned to your pharmacy")
    
    if order["status"] != OrderStatus.PHARMACY_ACCEPTED.value:
        raise HTTPException(status_code=400, detail="Order must be accepted before inventory confirmation")
    
    # Update items with inventory details (batch & expiry only - NO price input)
    # Price is already set from MEDILO master during order creation
    updated_items = []
    
    for order_item in order["items"]:
        inv_item = next((i for i in data.items if i.get("medicine_id") == order_item["medicine_id"]), None)
        if not inv_item:
            raise HTTPException(status_code=400, detail=f"Missing inventory for {order_item['medicine_name']}")
        
        # Only update batch and expiry - price comes from MEDILO master (already in order_item)
        updated_item = {
            **order_item,
            "batch_number": inv_item.get("batch_number"),
            "expiry_date": inv_item.get("expiry_date")
        }
        updated_items.append(updated_item)
    
    update_data = {
        "items": updated_items,
        "status": OrderStatus.INVENTORY_CONFIRMED.value,
        "invoice_generated": True,
        "updated_at": get_utc_now()
    }
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_audit("inventory_confirmed", "order", order_id, user["id"], user["role"], {"total_amount": order["total_amount"]})
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0, "highest_bucket": 0})
    return OrderResponse(**order)

# Customer order actions
@api_router.post("/orders/{order_id}/upload-prescription", response_model=OrderResponse)
async def upload_prescription(order_id: str, prescription_image: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Only customers can upload prescriptions")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if order["status"] != OrderStatus.PRESCRIPTION_REQUESTED.value:
        raise HTTPException(status_code=400, detail="Prescription upload not required")
    
    update_data = {
        "prescription_image": prescription_image,
        "status": OrderStatus.PENDING_PHARMACIST_REVIEW.value,
        "updated_at": get_utc_now()
    }
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_audit("prescription_uploaded", "order", order_id, user["id"], user["role"])
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0, "highest_bucket": 0})
    return OrderResponse(**order)

@api_router.post("/orders/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(order_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Only customers can cancel orders")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Can only cancel before delivery starts
    non_cancellable = [OrderStatus.OUT_FOR_DELIVERY.value, OrderStatus.DELIVERED.value]
    if order["status"] in non_cancellable:
        raise HTTPException(status_code=400, detail="Order cannot be cancelled at this stage")
    
    update_data = {
        "status": OrderStatus.CANCELLED.value,
        "updated_at": get_utc_now()
    }
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_audit("order_cancelled", "order", order_id, user["id"], user["role"])
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0, "highest_bucket": 0})
    return OrderResponse(**order)

# Invoice Route (Simple HTML-based PDF simulation)
@api_router.get("/orders/{order_id}/invoice")
async def get_invoice(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check access
    if user["role"] == UserRole.CUSTOMER.value and order["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not order.get("invoice_generated"):
        raise HTTPException(status_code=400, detail="Invoice not yet generated")
    
    pharmacy = await db.pharmacies.find_one({"id": order.get("pharmacy_id")}, {"_id": 0})
    
    # Generate simple invoice HTML
    items_html = ""
    for item in order["items"]:
        items_html += f"""
        <tr>
            <td>{item['medicine_name']}</td>
            <td>{item.get('batch_number', '-')}</td>
            <td>{item.get('expiry_date', '-')}</td>
            <td>{item['quantity']}</td>
            <td>₹{item.get('unit_price', 0):.2f}</td>
            <td>₹{(item.get('unit_price', 0) * item['quantity']):.2f}</td>
        </tr>
        """
    
    invoice_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Invoice - {order_id[:8]}</title>
        <style>
            body {{ font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: auto; }}
            .header {{ text-align: center; border-bottom: 2px solid #0F62FE; padding-bottom: 20px; }}
            .logo {{ color: #0F62FE; font-size: 24px; font-weight: bold; }}
            table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
            th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
            th {{ background: #f5f5f5; }}
            .total {{ font-weight: bold; font-size: 18px; text-align: right; }}
            .pharmacy-info {{ background: #f9f9f9; padding: 15px; margin: 20px 0; }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">MEDILO</div>
            <p>Tax Invoice</p>
        </div>
        
        <div class="pharmacy-info">
            <strong>Pharmacy:</strong> {pharmacy.get('name', 'N/A') if pharmacy else 'N/A'}<br>
            <strong>License No:</strong> {pharmacy.get('license_number', 'N/A') if pharmacy else 'N/A'}<br>
            <strong>Address:</strong> {pharmacy.get('address', 'N/A') if pharmacy else 'N/A'}
        </div>
        
        <p><strong>Order ID:</strong> {order['id'][:8].upper()}</p>
        <p><strong>Date:</strong> {order['created_at'][:10]}</p>
        <p><strong>Customer:</strong> {order['customer_name']} ({order['customer_phone']})</p>
        <p><strong>Delivery Address:</strong> {order['delivery_address']}</p>
        
        <table>
            <thead>
                <tr>
                    <th>Medicine</th>
                    <th>Batch No.</th>
                    <th>Expiry</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                {items_html}
            </tbody>
        </table>
        
        <p class="total">Total: ₹{order.get('total_amount', 0):.2f}</p>
        
        <p style="margin-top: 40px; font-size: 12px; color: #666;">
            This is a computer-generated invoice and does not require a signature.
        </p>
    </body>
    </html>
    """
    
    return StreamingResponse(
        io.BytesIO(invoice_html.encode()),
        media_type="text/html",
        headers={"Content-Disposition": f"inline; filename=invoice_{order_id[:8]}.html"}
    )

# Ops Routes
@api_router.get("/ops/orders", response_model=List[OrderResponse])
async def ops_get_orders(status: OrderStatus = None, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can access this")
    
    query = {}
    if status:
        query["status"] = status.value
    
    orders = await db.orders.find(query, {"_id": 0, "highest_bucket": 0}).sort("created_at", -1).to_list(1000)
    return [OrderResponse(**o) for o in orders]

@api_router.get("/ops/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    entity_type: str = None,
    entity_id: str = None,
    limit: int = 100,
    user: dict = Depends(get_current_user)
):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can access audit logs")
    
    query = {}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return [AuditLogResponse(**log) for log in logs]

@api_router.get("/ops/audit-logs/export")
async def export_audit_logs(
    start_date: str = None,
    end_date: str = None,
    entity_type: str = None,
    user: dict = Depends(get_current_user)
):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can export audit logs")
    
    query = {}
    if entity_type:
        query["entity_type"] = entity_type
    if start_date:
        query["timestamp"] = {"$gte": start_date}
    if end_date:
        query.setdefault("timestamp", {})["$lte"] = end_date + "T23:59:59"
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(10000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "Action", "Entity Type", "Entity ID", "User ID", "User Role", "Details"])
    
    for log in logs:
        details_str = ""
        if log.get("details"):
            try:
                import json
                details_str = json.dumps(log["details"])
            except Exception:
                details_str = str(log.get("details", ""))
        writer.writerow([
            log.get("timestamp", ""),
            log.get("action", ""),
            log.get("entity_type", ""),
            log.get("entity_id", ""),
            log.get("user_id", ""),
            log.get("user_role", ""),
            details_str
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=medilo_audit_logs_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"}
    )

@api_router.get("/ops/order/{order_id}/timeline", response_model=List[AuditLogResponse])
async def get_order_timeline(order_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can access this")
    
    logs = await db.audit_logs.find(
        {"entity_type": "order", "entity_id": order_id},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(100)
    return [AuditLogResponse(**log) for log in logs]

# User Management (for Ops)
@api_router.get("/ops/users", response_model=List[UserResponse])
async def get_users(role: UserRole = None, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can access this")
    
    query = {}
    if role:
        query["role"] = role.value
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.post("/ops/users/{user_id}/toggle-active")
async def toggle_user_active(user_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can manage users")
    
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_status = not target_user.get("is_active", True)
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": new_status}})
    await log_audit(
        "user_status_changed",
        "user",
        user_id,
        user["id"],
        user["role"],
        {"new_status": new_status}
    )
    
    return {"message": f"User {'activated' if new_status else 'deactivated'}"}

# Delivery Partner Routes
@api_router.post("/auth/delivery/register", response_model=UserResponse)
async def register_delivery_partner(data: DeliveryPartnerCreate, user: dict = Depends(get_current_user)):
    """Register a new delivery partner (Ops only)"""
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can register delivery partners")
    
    # Check if phone already exists
    existing = await db.users.find_one({"phone": data.phone})
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    new_user = {
        "id": generate_id(),
        "phone": data.phone,
        "name": data.name,
        "role": UserRole.DELIVERY_PARTNER.value,
        "is_active": True,
        "created_at": get_utc_now()
    }
    await db.users.insert_one(new_user)
    await log_audit("delivery_partner_registered", "user", new_user["id"], user["id"], user["role"])
    
    return UserResponse(**{k: v for k, v in new_user.items() if k != "_id"})

@api_router.post("/auth/delivery/login", response_model=TokenResponse)
async def login_delivery_partner(data: DeliveryPartnerLogin):
    user = await db.users.find_one({"phone": data.phone, "role": UserRole.DELIVERY_PARTNER.value}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Delivery partner not registered")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")
    
    await log_audit("delivery_partner_login", "user", user["id"], user["id"], user["role"])
    token = create_token(user["id"], user["role"])
    return TokenResponse(access_token=token, user=UserResponse(**user))

@api_router.get("/delivery/orders", response_model=List[DeliveryOrderResponse])
async def get_delivery_orders(user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.DELIVERY_PARTNER.value:
        raise HTTPException(status_code=403, detail="Only delivery partners can access this")
    
    # Show orders that are ready for pickup or assigned to this delivery partner
    query = {
        "$or": [
            {"status": OrderStatus.READY_FOR_PICKUP.value, "delivery_partner_id": None},
            {"delivery_partner_id": user["id"], "status": {"$in": [
                OrderStatus.READY_FOR_PICKUP.value,
                OrderStatus.PICKED_UP.value,
                OrderStatus.OUT_FOR_DELIVERY.value
            ]}}
        ]
    }
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Get pharmacy phone numbers
    pharmacy_ids = list(set(o.get("pharmacy_id") for o in orders if o.get("pharmacy_id")))
    pharmacies = {}
    if pharmacy_ids:
        pharm_list = await db.pharmacies.find({"id": {"$in": pharmacy_ids}}, {"_id": 0}).to_list(100)
        pharmacies = {p["id"]: p for p in pharm_list}
    
    result = []
    for o in orders:
        pharmacy = pharmacies.get(o.get("pharmacy_id"), {})
        result.append(DeliveryOrderResponse(
            id=o["id"],
            customer_phone=o["customer_phone"],
            customer_name=o["customer_name"],
            status=o["status"],
            delivery_address=o["delivery_address"],
            latitude=o["latitude"],
            longitude=o["longitude"],
            pharmacy_name=o.get("pharmacy_name"),
            pharmacy_address=o.get("pharmacy_address"),
            pharmacy_phone=pharmacy.get("phone"),
            pharmacy_latitude=o.get("pharmacy_latitude"),
            pharmacy_longitude=o.get("pharmacy_longitude"),
            item_count=len(o.get("items", [])),
            delivery_partner_id=o.get("delivery_partner_id"),
            created_at=o["created_at"],
            updated_at=o["updated_at"]
        ))
    
    return result

@api_router.get("/delivery/orders/{order_id}", response_model=DeliveryOrderResponse)
async def get_delivery_order(order_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.DELIVERY_PARTNER.value:
        raise HTTPException(status_code=403, detail="Only delivery partners can access this")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if delivery partner can access this order
    if order.get("delivery_partner_id") and order.get("delivery_partner_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Order assigned to another delivery partner")
    
    if order["status"] not in [
        OrderStatus.READY_FOR_PICKUP.value,
        OrderStatus.PICKED_UP.value,
        OrderStatus.OUT_FOR_DELIVERY.value,
        OrderStatus.DELIVERED.value
    ]:
        raise HTTPException(status_code=403, detail="Order not available for delivery")
    
    # Get pharmacy details
    pharmacy = await db.pharmacies.find_one({"id": order.get("pharmacy_id")}, {"_id": 0}) if order.get("pharmacy_id") else {}
    
    return DeliveryOrderResponse(
        id=order["id"],
        customer_phone=order["customer_phone"],
        customer_name=order["customer_name"],
        status=order["status"],
        delivery_address=order["delivery_address"],
        latitude=order["latitude"],
        longitude=order["longitude"],
        pharmacy_name=order.get("pharmacy_name"),
        pharmacy_address=order.get("pharmacy_address"),
        pharmacy_phone=pharmacy.get("phone") if pharmacy else None,
        pharmacy_latitude=order.get("pharmacy_latitude"),
        pharmacy_longitude=order.get("pharmacy_longitude"),
        item_count=len(order.get("items", [])),
        delivery_partner_id=order.get("delivery_partner_id"),
        created_at=order["created_at"],
        updated_at=order["updated_at"]
    )

@api_router.post("/delivery/orders/{order_id}/accept", response_model=DeliveryOrderResponse)
async def accept_delivery(order_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.DELIVERY_PARTNER.value:
        raise HTTPException(status_code=403, detail="Only delivery partners can accept deliveries")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] != OrderStatus.READY_FOR_PICKUP.value:
        raise HTTPException(status_code=400, detail="Order is not ready for pickup")
    
    if order.get("delivery_partner_id") and order.get("delivery_partner_id") != user["id"]:
        raise HTTPException(status_code=400, detail="Order already assigned to another delivery partner")
    
    update_data = {
        "delivery_partner_id": user["id"],
        "delivery_partner_name": user["name"],
        "status": OrderStatus.PICKED_UP.value,  # Change status to picked_up when delivery is accepted
        "updated_at": get_utc_now()
    }
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_audit("delivery_accepted", "order", order_id, user["id"], user["role"])
    
    # Return updated order
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    pharmacy = await db.pharmacies.find_one({"id": order.get("pharmacy_id")}, {"_id": 0}) if order.get("pharmacy_id") else {}
    
    return DeliveryOrderResponse(
        id=order["id"],
        customer_phone=order["customer_phone"],
        customer_name=order["customer_name"],
        status=order["status"],
        delivery_address=order["delivery_address"],
        latitude=order["latitude"],
        longitude=order["longitude"],
        pharmacy_name=order.get("pharmacy_name"),
        pharmacy_address=order.get("pharmacy_address"),
        pharmacy_phone=pharmacy.get("phone") if pharmacy else None,
        pharmacy_latitude=order.get("pharmacy_latitude"),
        pharmacy_longitude=order.get("pharmacy_longitude"),
        item_count=len(order.get("items", [])),
        delivery_partner_id=order.get("delivery_partner_id"),
        created_at=order["created_at"],
        updated_at=order["updated_at"]
    )

@api_router.post("/delivery/orders/{order_id}/action", response_model=DeliveryOrderResponse)
async def delivery_action(order_id: str, data: DeliveryAction, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.DELIVERY_PARTNER.value:
        raise HTTPException(status_code=403, detail="Only delivery partners can perform this action")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("delivery_partner_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Order not assigned to you")
    
    update_data = {"updated_at": get_utc_now()}
    
    if data.action == "pickup":
        if order["status"] != OrderStatus.READY_FOR_PICKUP.value:
            raise HTTPException(status_code=400, detail="Order must be ready for pickup")
        update_data["status"] = OrderStatus.PICKED_UP.value
    elif data.action == "out_for_delivery":
        if order["status"] != OrderStatus.PICKED_UP.value:
            raise HTTPException(status_code=400, detail="Order must be picked up first")
        update_data["status"] = OrderStatus.OUT_FOR_DELIVERY.value
    elif data.action == "delivered":
        if order["status"] != OrderStatus.OUT_FOR_DELIVERY.value:
            raise HTTPException(status_code=400, detail="Order must be out for delivery")
        update_data["status"] = OrderStatus.DELIVERED.value
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use: pickup, out_for_delivery, delivered")
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_audit(f"delivery_{data.action}", "order", order_id, user["id"], user["role"])
    
    # Return updated order
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    pharmacy = await db.pharmacies.find_one({"id": order.get("pharmacy_id")}, {"_id": 0}) if order.get("pharmacy_id") else {}
    
    return DeliveryOrderResponse(
        id=order["id"],
        customer_phone=order["customer_phone"],
        customer_name=order["customer_name"],
        status=order["status"],
        delivery_address=order["delivery_address"],
        latitude=order["latitude"],
        longitude=order["longitude"],
        pharmacy_name=order.get("pharmacy_name"),
        pharmacy_address=order.get("pharmacy_address"),
        pharmacy_phone=pharmacy.get("phone") if pharmacy else None,
        pharmacy_latitude=order.get("pharmacy_latitude"),
        pharmacy_longitude=order.get("pharmacy_longitude"),
        item_count=len(order.get("items", [])),
        delivery_partner_id=order.get("delivery_partner_id"),
        created_at=order["created_at"],
        updated_at=order["updated_at"]
    )

@api_router.post("/delivery/orders/{order_id}/report-issue")
async def report_delivery_issue(order_id: str, data: DeliveryIssueReport, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.DELIVERY_PARTNER.value:
        raise HTTPException(status_code=403, detail="Only delivery partners can report issues")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("delivery_partner_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Order not assigned to you")
    
    # Log the issue
    issue = {
        "id": generate_id(),
        "order_id": order_id,
        "delivery_partner_id": user["id"],
        "issue_type": data.issue_type,
        "description": data.description,
        "created_at": get_utc_now()
    }
    await db.delivery_issues.insert_one(issue)
    await log_audit("delivery_issue_reported", "order", order_id, user["id"], user["role"], {
        "issue_type": data.issue_type,
        "description": data.description
    })
    
    return {"message": "Issue reported successfully", "issue_id": issue["id"]}

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": get_utc_now()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.on_event("startup")
async def migrate_categories():
    """Migrate old category values and init storage"""
    result = await db.medicines.update_many(
        {"product_type": "Beauty"},
        {"$set": {"product_type": "Beauty & Personal Care"}}
    )
    if result.modified_count > 0:
        logger.info(f"Migrated {result.modified_count} products from 'Beauty' to 'Beauty & Personal Care'")
    
    try:
        init_storage()
        logger.info("Object storage initialized successfully")
    except Exception as e:
        logger.error(f"Object storage init failed: {e}")
