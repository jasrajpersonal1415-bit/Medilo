import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from server import build_invoice_pdf  # noqa: E402


SAMPLE_ORDER = {
    "id": "abcd1234-test-0000",
    "customer_name": "Test Customer",
    "customer_phone": "9876543210",
    "delivery_address": "12 MG Road, Bengaluru, KA - 560001",
    "created_at": "2026-06-17T10:00:00+00:00",
    "items": [
        {"medicine_name": "Dolo 650", "batch_number": "B123", "expiry_date": "2027-05", "quantity": 2, "unit_price": 32.0},
        {"medicine_name": "Vitamin C", "batch_number": "V900", "expiry_date": "2028-01", "quantity": 1, "unit_price": 150.0},
    ],
    "subtotal": 214.0,
    "total_savings": 21.4,   # 10% discount
    "total_amount": 192.6,
}

SAMPLE_PHARMACY = {"name": "City Pharmacy", "license_number": "DL-KA-12345", "address": "5 Brigade Rd, Bengaluru"}


def test_pdf_is_valid_pdf():
    pdf = build_invoice_pdf(SAMPLE_ORDER, SAMPLE_PHARMACY)
    assert pdf[:4] == b"%PDF", "Output is not a PDF"
    assert len(pdf) > 1000


def test_pdf_handles_missing_pharmacy():
    pdf = build_invoice_pdf(SAMPLE_ORDER, None)
    assert pdf[:4] == b"%PDF"


if __name__ == "__main__":
    out = build_invoice_pdf(SAMPLE_ORDER, SAMPLE_PHARMACY)
    Path("/tmp/invoice_discount.pdf").write_bytes(out)
    print("Wrote /tmp/invoice_discount.pdf", len(out), "bytes; header:", out[:4])
