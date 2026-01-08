from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
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
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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

class MedicineBucket(str, Enum):
    OTC = "OTC"  # Bucket A - Green
    SCHEDULE_H = "SCHEDULE_H"  # Bucket B - Yellow
    SCHEDULE_H1 = "SCHEDULE_H1"  # Bucket C - Red

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
    bucket: MedicineBucket
    strength: str
    form: str  # tablet, capsule, syrup, etc.
    description: Optional[str] = None

class MedicineResponse(BaseModel):
    id: str
    name: str
    generic_name: str
    manufacturer: str
    bucket: MedicineBucket
    strength: str
    form: str
    description: Optional[str] = None
    is_active: bool = True
    created_at: str

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
    medicine_bucket: MedicineBucket
    quantity: int
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    unit_price: Optional[float] = None

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
    pharmacist_id: Optional[str] = None
    pharmacist_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    total_amount: Optional[float] = None
    invoice_generated: bool = False
    created_at: str
    updated_at: str

class PharmacistAction(BaseModel):
    action: str  # approve, reject, request_prescription
    notes: Optional[str] = None

class PharmacyAction(BaseModel):
    action: str  # accept, reject, confirm_inventory, mark_preparing, mark_ready
    rejection_reason: Optional[str] = None

class InventoryConfirmation(BaseModel):
    items: List[dict]  # Each item has medicine_id, batch_number, expiry_date, unit_price

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
        "bucket": data.bucket.value,
        "is_active": True,
        "created_at": get_utc_now()
    }
    await db.medicines.insert_one(medicine)
    await log_audit("medicine_created", "medicine", medicine["id"], user["id"], user["role"], {"name": data.name})
    return MedicineResponse(**{k: v for k, v in medicine.items() if k != "_id"})

@api_router.get("/medicines", response_model=List[MedicineResponse])
async def get_medicines(search: str = None, bucket: MedicineBucket = None):
    query = {"is_active": True}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"generic_name": {"$regex": search, "$options": "i"}}
        ]
    if bucket:
        query["bucket"] = bucket.value
    
    medicines = await db.medicines.find(query, {"_id": 0}).to_list(1000)
    return [MedicineResponse(**m) for m in medicines]

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
    update_data["bucket"] = data.bucket.value
    
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
    
    # Validate items and determine highest bucket
    items = []
    highest_bucket = MedicineBucket.OTC
    bucket_priority = {MedicineBucket.OTC: 0, MedicineBucket.SCHEDULE_H: 1, MedicineBucket.SCHEDULE_H1: 2}
    
    for item in data.items:
        medicine = await db.medicines.find_one({"id": item.medicine_id, "is_active": True}, {"_id": 0})
        if not medicine:
            raise HTTPException(status_code=400, detail=f"Medicine {item.medicine_id} not found")
        
        order_item = OrderItem(
            medicine_id=item.medicine_id,
            medicine_name=medicine["name"],
            medicine_bucket=medicine["bucket"],
            quantity=item.quantity
        )
        items.append(order_item.model_dump())
        
        med_bucket = MedicineBucket(medicine["bucket"])
        if bucket_priority[med_bucket] > bucket_priority[highest_bucket]:
            highest_bucket = med_bucket
    
    # Validate prescription requirements
    if highest_bucket == MedicineBucket.SCHEDULE_H1 and not data.prescription_image:
        raise HTTPException(status_code=400, detail="Prescription upload is mandatory for Schedule H1 medicines")
    
    if highest_bucket == MedicineBucket.SCHEDULE_H and not data.prescription_image and not data.schedule_h_declaration:
        raise HTTPException(status_code=400, detail="Either prescription upload or declaration is required for Schedule H medicines")
    
    # Determine initial status
    if highest_bucket == MedicineBucket.OTC:
        initial_status = OrderStatus.PHARMACIST_APPROVED  # OTC doesn't need pharmacist review
    else:
        initial_status = OrderStatus.PENDING_PHARMACIST_REVIEW
    
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
        "highest_bucket": highest_bucket.value,
        "pharmacy_id": None,
        "pharmacy_name": None,
        "pharmacist_id": None,
        "pharmacist_notes": None,
        "rejection_reason": None,
        "total_amount": None,
        "invoice_generated": False,
        "created_at": get_utc_now(),
        "updated_at": get_utc_now()
    }
    
    await db.orders.insert_one(order)
    await log_audit("order_created", "order", order["id"], user["id"], user["role"], {"status": initial_status.value})
    
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
        update_data["status"] = OrderStatus.OUT_FOR_DELIVERY.value
    elif data.action == "mark_delivered":
        if order["status"] != OrderStatus.OUT_FOR_DELIVERY.value:
            raise HTTPException(status_code=400, detail="Order must be out for delivery first")
        update_data["status"] = OrderStatus.DELIVERED.value
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
    
    # Update items with inventory details
    updated_items = []
    total_amount = 0
    
    for order_item in order["items"]:
        inv_item = next((i for i in data.items if i.get("medicine_id") == order_item["medicine_id"]), None)
        if not inv_item:
            raise HTTPException(status_code=400, detail=f"Missing inventory for {order_item['medicine_name']}")
        
        updated_item = {
            **order_item,
            "batch_number": inv_item.get("batch_number"),
            "expiry_date": inv_item.get("expiry_date"),
            "unit_price": inv_item.get("unit_price", 0)
        }
        updated_items.append(updated_item)
        total_amount += updated_item["unit_price"] * updated_item["quantity"]
    
    update_data = {
        "items": updated_items,
        "total_amount": total_amount,
        "status": OrderStatus.INVENTORY_CONFIRMED.value,
        "invoice_generated": True,
        "updated_at": get_utc_now()
    }
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_audit("inventory_confirmed", "order", order_id, user["id"], user["role"], {"total_amount": total_amount})
    
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
