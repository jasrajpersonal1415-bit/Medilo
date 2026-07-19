import uuid
import io
import csv
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from typing import List, Optional

from config import (
    db, logger, security, APP_NAME,
    JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS,
    MEDILO_GSTIN, GST_RATE,
)
from models import *


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

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB

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

CATEGORY_DISCOUNTS = {
    "Medicine": 0.10,
    "Baby Care": 0.20,
    "Wellness": 0.12,
    "Beauty & Personal Care": 0.08,
    "Device": 0.0,
}

CART_DISCOUNT_TIERS = [
    (3000, 0.10),  # ≥₹3000 → extra 10% (checked first = highest)
    (2000, 0.05),  # ≥₹2000 → extra 5%
]

def calculate_discounts(items_with_prices):
    """Calculate category and cart-level discounts.
    items_with_prices: list of dicts with product_type, unit_price, quantity
    Returns: subtotal, category_discount, cart_discount, total_savings, total_amount
    """
    subtotal = 0.0
    category_discount = 0.0
    medicine_subtotal_after_discount = 0.0
    
    for item in items_with_prices:
        item_total = item["unit_price"] * item["quantity"]
        subtotal += item_total
        
        product_type = item.get("product_type", "Medicine")
        cat_rate = CATEGORY_DISCOUNTS.get(product_type, 0.0)
        item_discount = item_total * cat_rate
        category_discount += item_discount
        
        if product_type == "Medicine":
            medicine_subtotal_after_discount += item_total - item_discount
    
    # Cart-level discount: applies only on medicine subtotal after category discount
    cart_discount = 0.0
    for threshold, rate in CART_DISCOUNT_TIERS:
        if medicine_subtotal_after_discount >= threshold:
            cart_discount = medicine_subtotal_after_discount * rate
            break  # Highest eligible only
    
    total_savings = round(category_discount + cart_discount, 2)
    total_amount = round(subtotal - total_savings, 2)
    
    return {
        "subtotal": round(subtotal, 2),
        "category_discount": round(category_discount, 2),
        "cart_discount": round(cart_discount, 2),
        "total_savings": total_savings,
        "total_amount": total_amount,
    }

def _inr(x):
    return f"Rs. {x:,.2f}"

def build_invoice_pdf(order: dict, pharmacy: dict) -> bytes:
    """Generate a GST-style tax invoice PDF (prices are GST-inclusive MRP, CGST+SGST split)."""
    items = order.get("items", [])

    # Subtotal (GST-inclusive MRP, before discount)
    subtotal = order.get("subtotal")
    if subtotal is None:
        subtotal = sum((it.get("unit_price", 0) or 0) * it.get("quantity", 0) for it in items)
    subtotal = round(subtotal or 0, 2)

    # Net payable (GST-inclusive, after discount)
    net = order.get("total_amount")
    if net is None:
        net = subtotal
    net = round(net or 0, 2)

    # Discount as a percentage (no item-wise breakdown)
    total_savings = order.get("total_savings")
    if total_savings is None:
        total_savings = round(max(subtotal - net, 0), 2)
    discount_pct = round((total_savings / subtotal * 100), 1) if subtotal > 0 and total_savings > 0 else 0

    # Back-calculate GST out of the GST-inclusive net amount
    taxable_value = round(net / (1 + GST_RATE / 100), 2)
    total_gst = round(net - taxable_value, 2)
    cgst = round(total_gst / 2, 2)
    sgst = round(total_gst - cgst, 2)
    half_rate = GST_RATE / 2

    styles = getSampleStyleSheet()
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8, leading=10, textColor=colors.HexColor("#444444"))
    cell = ParagraphStyle("cell", parent=styles["Normal"], fontSize=9, leading=11)
    cell_sub = ParagraphStyle("cell_sub", parent=styles["Normal"], fontSize=7, leading=9, textColor=colors.HexColor("#777777"))
    h_title = ParagraphStyle("h_title", parent=styles["Normal"], fontSize=22, leading=24, textColor=colors.HexColor("#0F62FE"), fontName="Helvetica-Bold")
    label_r = ParagraphStyle("label_r", parent=styles["Normal"], fontSize=9, leading=12, alignment=TA_RIGHT)
    value_r = ParagraphStyle("value_r", parent=styles["Normal"], fontSize=9, leading=12, alignment=TA_RIGHT, fontName="Helvetica-Bold")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm,
                            leftMargin=16 * mm, rightMargin=16 * mm, title=f"Invoice {order['id'][:8].upper()}")
    elems = []

    # ---- Header band: brand + TAX INVOICE ----
    header = Table([[
        Paragraph("MEDILO", h_title),
        Paragraph("<b>TAX INVOICE</b>", ParagraphStyle("ti", parent=styles["Normal"], fontSize=14, alignment=TA_RIGHT, fontName="Helvetica-Bold"))
    ]], colWidths=[90 * mm, 88 * mm])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -1), 1.2, colors.HexColor("#0F62FE")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elems.append(header)
    elems.append(Spacer(1, 8))

    # ---- Seller (pharmacy) + invoice meta ----
    ph_name = (pharmacy or {}).get("name", "N/A")
    ph_addr = (pharmacy or {}).get("address", "N/A")
    ph_lic = (pharmacy or {}).get("license_number", "N/A")
    seller = (
        f"<b>MEDILO Healthcare Pvt. Ltd.</b><br/>"
        f"GSTIN: {MEDILO_GSTIN}<br/>"
        f"Dispensing Pharmacy: {ph_name}<br/>"
        f"Drug License No: {ph_lic}<br/>"
        f"{ph_addr}"
    )
    meta = (
        f"Invoice No: <b>INV-{order['id'][:8].upper()}</b><br/>"
        f"Order ID: {order['id'][:8].upper()}<br/>"
        f"Invoice Date: {str(order.get('created_at', ''))[:10]}<br/>"
        f"Place of Supply: India"
    )
    info = Table([[Paragraph(seller, small), Paragraph(meta, ParagraphStyle("meta", parent=small, alignment=TA_RIGHT))]],
                 colWidths=[100 * mm, 78 * mm])
    info.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elems.append(info)
    elems.append(Spacer(1, 10))

    # ---- Bill To ----
    bill_to = (
        f"<b>Bill To</b><br/>{order.get('customer_name', '')} ({order.get('customer_phone', '')})<br/>"
        f"{order.get('delivery_address', '')}"
    )
    bt = Table([[Paragraph(bill_to, small)]], colWidths=[178 * mm])
    bt.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f9fafb")),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    elems.append(bt)
    elems.append(Spacer(1, 10))

    # ---- Items table ----
    data = [["#", "Item Description", "Qty", "Rate\n(incl. GST)", "Amount"]]
    for idx, it in enumerate(items, 1):
        name = it.get("medicine_name", "")
        batch = it.get("batch_number") or "-"
        expiry = it.get("expiry_date") or "-"
        desc = Paragraph(f"{name}<br/><font size=7 color='#777777'>Batch: {batch} &nbsp; Exp: {expiry}</font>", cell)
        qty = it.get("quantity", 0)
        rate = it.get("unit_price", 0) or 0
        amount = rate * qty
        data.append([str(idx), desc, str(qty), _inr(rate), _inr(amount)])

    tbl = Table(data, colWidths=[10 * mm, 96 * mm, 14 * mm, 28 * mm, 30 * mm], repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F62FE")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#dddddd")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7f9fc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elems.append(tbl)
    elems.append(Spacer(1, 10))

    # ---- Summary (right aligned) ----
    summary_rows = [
        [Paragraph("Subtotal (MRP)", label_r), Paragraph(_inr(subtotal), value_r)],
    ]
    if discount_pct > 0:
        summary_rows.append([Paragraph(f"Discount ({discount_pct}%)", label_r),
                             Paragraph(f"- {_inr(total_savings)}", ParagraphStyle("disc", parent=value_r, textColor=colors.HexColor("#16a34a")))])
    summary_rows += [
        [Paragraph("Net Amount (incl. GST)", label_r), Paragraph(_inr(net), value_r)],
        [Paragraph("Taxable Value", label_r), Paragraph(_inr(taxable_value), value_r)],
        [Paragraph(f"CGST @ {half_rate:g}%", label_r), Paragraph(_inr(cgst), value_r)],
        [Paragraph(f"SGST @ {half_rate:g}%", label_r), Paragraph(_inr(sgst), value_r)],
        [Paragraph("<b>Grand Total</b>", ParagraphStyle("gt", parent=label_r, fontSize=11)),
         Paragraph(f"<b>{_inr(net)}</b>", ParagraphStyle("gtv", parent=value_r, fontSize=11, textColor=colors.HexColor("#0F62FE")))],
    ]
    summary = Table(summary_rows, colWidths=[48 * mm, 38 * mm], hAlign="RIGHT")
    summary.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEABOVE", (0, -1), (-1, -1), 0.8, colors.HexColor("#0F62FE")),
        ("LINEBELOW", (0, len(summary_rows) - 2), (-1, len(summary_rows) - 2), 0.4, colors.HexColor("#dddddd")),
    ]))
    elems.append(summary)
    elems.append(Spacer(1, 18))

    note = (
        f"All prices are inclusive of GST @ {GST_RATE:g}% (CGST {half_rate:g}% + SGST {half_rate:g}%). "
        "This is a computer-generated invoice and does not require a signature."
    )
    elems.append(Paragraph(note, ParagraphStyle("note", parent=small, fontSize=7.5, textColor=colors.HexColor("#888888"))))

    doc.build(elems)
    buf.seek(0)
    return buf.getvalue()
