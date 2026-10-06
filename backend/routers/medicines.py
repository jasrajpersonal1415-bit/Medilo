from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from config import db, put_object, get_object, APP_NAME
import uuid
from typing import List
from models import (
    UserRole, MedicineBucket, ProductType, MedicineCreate, MedicineResponse,
)
from services import (
    generate_id, get_utc_now, get_current_user, log_audit, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE,
)

router = APIRouter(prefix="/api")


@router.post("/medicines", response_model=MedicineResponse)
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

@router.get("/medicines", response_model=List[MedicineResponse])
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

@router.get("/categories", response_model=List[dict])
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

@router.get("/medicines/{medicine_id}", response_model=MedicineResponse)
async def get_medicine(medicine_id: str):
    medicine = await db.medicines.find_one({"id": medicine_id}, {"_id": 0})
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return MedicineResponse(**medicine)

@router.put("/medicines/{medicine_id}", response_model=MedicineResponse)
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

@router.delete("/medicines/{medicine_id}")
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

@router.post("/products/{product_id}/image")
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

@router.get("/files/{path:path}")
async def serve_file(path: str):
    try:
        data, content_type = get_object(path)
        return Response(content=data, media_type=content_type)
    except Exception:
        raise HTTPException(status_code=404, detail="File not found")
