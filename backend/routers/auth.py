from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from config import db, put_object, get_object, APP_NAME
from models import *
from services import *

router = APIRouter(prefix="/api")


@router.post("/auth/customer/register", response_model=TokenResponse)
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

@router.post("/auth/customer/login", response_model=TokenResponse)
async def login_customer(data: CustomerLogin):
    user = await db.users.find_one({"phone": data.phone, "role": UserRole.CUSTOMER.value}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Phone number not registered")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")
    
    await log_audit("customer_login", "user", user["id"], user["id"], user["role"])
    token = create_token(user["id"], user["role"])
    return TokenResponse(access_token=token, user=UserResponse(**user))

@router.post("/auth/staff/register", response_model=TokenResponse)
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

@router.post("/auth/staff/login", response_model=TokenResponse)
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

@router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(**{k: v for k, v in user.items() if k != "password_hash"})
