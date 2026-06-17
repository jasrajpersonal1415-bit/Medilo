# MEDILO Healthcare Pilot - Product Requirements Document

## Project Overview
**Name:** MEDILO Healthcare Pilot Application  
**Type:** Closed, Throw-Away Pilot  
**Max Users:** 300  
**Region:** India (Single City/Zone)  
**Status:** MVP Complete  
**Last Updated:** February 11, 2026

---

## Original Problem Statement
Build a CLOSED, THROW-AWAY PILOT APPLICATION for a healthcare startup called MEDILO (India). Maximum 300 users. Pharmacist accountability mandatory. No forced medicine substitution. Compliance > speed > growth. System must be auditable end-to-end.

---

## Product Categories

### Top-Level Categories
1. **Medicines** - Prescription & OTC medicines (follows bucket classification)
2. **Beauty & Personal Care** - Skincare & personal care products
3. **Wellness** - Health supplements & wellness products
4. **Baby Care** - Baby health & care essentials
5. **Medical Devices** - Health monitoring devices

### Medicine Classification (Only for Medicine type)
| Bucket | Category | Prescription | Pharmacist Review |
|--------|----------|--------------|-------------------|
| 🟢 OTC | Over-the-counter | Not required | Not required |
| 🟡 Schedule H | Chronic medicines | Optional (declaration allowed) | Required |
| 🔴 Schedule H1 | Controlled | MANDATORY | MANDATORY |

### Non-Medicine Products
- Wellness, Beauty, and Device products do NOT use bucket classification
- These products do NOT require pharmacist approval
- Mixed orders only require pharmacist review if they contain Schedule H/H1 medicines

---

## User Personas

### 1. Customer (Patient)
- **Access:** Mobile only (mobile web app)
- **Auth:** Phone number login (no OTP for pilot)
- **Can:** Browse categories, search products, place orders, upload prescriptions, track orders, download invoices
- **Cannot:** Choose pharmacy, force substitutions, bypass prescription rules

### 2. Pharmacy Staff
- **Access:** Desktop only (web dashboard)
- **Auth:** Email + Password
- **Can:** View assigned orders, accept/reject, confirm inventory (batch, expiry), manage order preparation and delivery status
- **Cannot:** Modify orders, bypass inventory confirmation, SET OR EDIT PRICES

### 3. Registered Pharmacist
- **Access:** Desktop only (web dashboard)
- **Auth:** Email + Password
- **Can:** Review orders containing Schedule H/H1 medicines, view prescriptions, approve/reject/request prescription, assign pharmacies
- **Cannot:** Skip review for Schedule H/H1 medicines

### 4. MEDILO Internal Ops
- **Access:** Desktop only (web dashboard)
- **Auth:** Email + Password
- **Can:** View all orders, audit logs, users, manage products (all categories), manage pharmacies, SET AND CONTROL PRICES
- **Cannot:** Modify orders, override rules, approve medicines

### 5. Delivery Partner
- **Access:** Mobile only (mobile web app)
- **Auth:** Phone number login
- **Can:** View assigned deliveries, accept deliveries, update status (picked_up, out_for_delivery, delivered), report issues
- **Cannot:** See product details, see prices, modify orders

---

## Core Requirements

### Order Workflow (STRICT SEQUENCE)
1. Order placed by customer
2. **Pharmacist review** (ONLY if order contains Schedule H/H1 medicines)
3. Pharmacy assignment
4. Pharmacy accepts
5. Inventory confirmation (batch, expiry for ALL products)
6. Invoice auto-generation (with MEDILO-controlled prices)
7. Preparation → Ready for Pickup
8. Delivery partner assigned → Picked up → Out for Delivery → Delivered

### Centralized Pricing (IMPLEMENTED ✅)
| Rule | Description |
|------|-------------|
| Price Master | MEDILO backend maintains centralized price list |
| Price Definition | By product name, strength, and pack size |
| Automatic Application | Price applied automatically during order creation |
| Customer Visibility | Price visible to customer before order confirmation |
| Invoice Pricing | Invoice uses MEDILO-defined prices only |
| Pharmacy Restrictions | Pharmacies CANNOT add/edit/override prices |

---

## What's Been Implemented ✅

### Backend (FastAPI + MongoDB)
- [x] User authentication (customer phone login, staff email+password, delivery partner phone login)
- [x] JWT token-based authorization
- [x] Role-based access control (customer, pharmacy_staff, pharmacist, ops, delivery_partner)
- [x] **Product categories** (Medicine, Wellness, Beauty, Device)
- [x] Product CRUD with category support
- [x] Medicine bucket classification (OTC, SCHEDULE_H, SCHEDULE_H1)
- [x] **Centralized pricing** - MEDILO-controlled prices
- [x] Pharmacy management
- [x] Order management with smart workflow (pharmacist review only for Schedule H/H1)
- [x] **Mixed orders support** - non-medicine products don't block processing
- [x] Invoice generation (HTML format with MEDILO prices)
- [x] Delivery partner endpoints
- [x] Audit logging for all actions

### Frontend (React + Tailwind + Shadcn UI)

#### Customer Mobile App
- [x] Phone number login/registration
- [x] **Category tiles homepage** (4 categories in grid)
- [x] Category-based product browsing
- [x] Product search across all categories
- [x] Shopping cart with mixed products
- [x] Prescription upload for Schedule H1
- [x] Declaration checkbox for Schedule H
- [x] Order placement with validation
- [x] Order history and tracking
- [x] Invoice download

#### Ops Dashboard
- [x] **Add Medicine button** (for medicines with bucket)
- [x] **Add Product button** (for non-medicine products)
- [x] Product type column in table
- [x] Edit and delete products
- [x] Pharmacy management
- [x] Staff account creation
- [x] Delivery partner registration

#### Pharmacist Dashboard
- [x] Pending orders queue (only Schedule H/H1 orders)
- [x] Prescription viewer
- [x] Approve/Reject with notes
- [x] Pharmacy assignment

#### Pharmacy Dashboard
- [x] Assigned orders view
- [x] Accept/Reject orders
- [x] Inventory confirmation (batch, expiry) for ALL products
- [x] Read-only price display
- [x] Status progression

#### Delivery Partner Dashboard
- [x] Accept delivery → Out for Delivery → Delivered flow
- [x] Issue reporting

---

## Prioritized Backlog

### P1 - High Priority
- [ ] PDF invoice generation (currently HTML)
- [x] Audit log export (CSV)
- [ ] Push notifications for order status

### P2 - Medium Priority
- [ ] Order history export (CSV)
- [ ] Pharmacy inventory management
- [ ] Multi-pharmacy availability check

### P3 - Nice to Have
- [ ] Product alternatives suggestion
- [ ] Analytics dashboard for Ops
- [ ] Refactor `server.py` into modular structure

---

## Technical Architecture

### Stack
- **Backend:** FastAPI (Python 3.x)
- **Database:** MongoDB
- **Frontend:** React 19 + Tailwind CSS + Shadcn UI
- **Auth:** JWT (phone-based for customers/delivery, email+password for staff)

### API Structure
- `/api/auth/*` - Authentication endpoints
- `/api/medicines` - Product CRUD (with product_type filter)
- `/api/categories` - Get product categories with counts
- `/api/pharmacies` - Pharmacy management
- `/api/orders` - Order management
- `/api/pharmacist/*` - Pharmacist actions
- `/api/pharmacy/*` - Pharmacy staff actions
- `/api/delivery/*` - Delivery partner actions

---

## Key Database Models

### products (medicines collection)
```json
{
  "id": "uuid",
  "name": "string",
  "generic_name": "string",
  "product_type": "Medicine|Wellness|Beauty|Device",
  "bucket": "OTC|SCHEDULE_H|SCHEDULE_H1 (only for Medicine)",
  "strength": "string",
  "form": "string",
  "manufacturer": "string",
  "price": "float (MEDILO-controlled)",
  "pack_size": "string"
}
```

### orders
```json
{
  "id": "uuid",
  "customer_id": "uuid",
  "items": [{
    "medicine_id": "uuid",
    "medicine_name": "string",
    "product_type": "Medicine|Wellness|Beauty|Device",
    "medicine_bucket": "OTC|SCHEDULE_H|SCHEDULE_H1 (nullable)",
    "quantity": "int",
    "unit_price": "float"
  }],
  "total_amount": "float",
  "status": "enum"
}
```

---

## Test Credentials

| Role | Email/Phone | Password |
|------|-------------|----------|
| Ops | ops@medilo.com | test123 |
| Pharmacist | pharmacist@medilo.com | test123 |
| Pharmacy Staff | pharmacy_staff@test.com | test123 |
| Customer | 9876543210 | (phone only) |
| Delivery Partner | 9999888877 | (phone only) |

---

## Changelog

### June, 2026
- ✅ **Customer Profile Phase 3 Complete** — Notifications, About MEDILO, and Privacy & Security pages.
  - Wired previously orphaned components into App.js router (`/profile/notifications`, `/profile/about`, `/profile/privacy`).
  - Added new "Account" section + Notifications entry to Profile menu (`Profile.js`).
  - Notifications: list/mark-read/mark-all-read/delete/clear via `/api/customer/notifications`.
  - Privacy & Security: Privacy Policy & Terms dialogs + account-deletion request (`/api/customer/delete-account-request`).
  - Tested via testing_agent (iteration_10): 33/34 assertions pass; all 3 routes + regression on existing profile links verified.

### April 11, 2026
- ✅ **PWA Implementation Validated** - Service Worker, Manifest, Icons all working
- ✅ **Audit Log Export** - CSV export with date range filters on Ops Dashboard
- ✅ **CSV Product Import** - Full Upload → Preview → Confirm → Import flow with validation, duplicate handling, batch tracking

### February 11, 2026
- ✅ **Product Categories Feature Complete**
  - Added 4 product categories: Medicine, Wellness, Beauty, Device
  - Customer homepage shows category tiles in mobile-optimized grid
  - Ops dashboard has "Add Medicine" and "Add Product" buttons
  - Non-medicine products skip pharmacist review
  - Mixed orders require pharmacist review only if containing Schedule H/H1
  - All order flow tests passed

### January 13, 2026
- ✅ **Centralized Pricing Feature Complete**
- ✅ **Delete Medicine Feature**
- ✅ **Edit Medicine Feature**
- ✅ **Delivery Partner Flow Fix**

### January 8, 2026
- ✅ Initial MVP with 4 roles
- ✅ Delivery Partner feature added
- ✅ Invoice download fix
