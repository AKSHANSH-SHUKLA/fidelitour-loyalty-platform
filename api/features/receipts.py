"""
Ticket numérique — B2C e-receipt sent to the customer (Features: wallet leverage).

Status: 🟢 Core.
Mounts at: /api/owner/receipts*
Storage: receipts collection.

WHY THIS EXISTS (terrain, août 2026)
    B2C sales don't go through B2B e-invoicing — they go through e-reporting.
    But the CUSTOMER still wants a proof of purchase, and the merchant already
    has FidClic's loyalty rail (customer record + email + web-push/wallet card).
    So: after a sale, one call sends the customer a clean digital receipt by
    email AND a push notification on the same channel used for offers. Paper
    ticket optional; the receipt is stored and re-sendable.

WHAT IT IS / ISN'T
    A ticket numérique is a PROOF OF PURCHASE for the customer. It is NOT a
    B2B e-invoice and does NOT replace e-reporting — the fiscal side of B2C
    stays covered by send_ereporting. (If the buyer is a company that needs a
    real invoice, use Nouvelle facture instead.)
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from auth import require_role

router = APIRouter(tags=["receipts"])
_db = None


def init(db):
    global _db
    _db = db
    try:
        _db.receipts.create_index([("tenant_id", 1), ("created_at", -1)])
    except Exception:
        pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _tenant(token_data) -> Dict[str, Any]:
    t = _db.tenants.find_one({"id": token_data.tenant_id})
    if not t:
        raise HTTPException(404, "Entreprise introuvable.")
    return t


def _receipt_html(shop: str, r: Dict[str, Any]) -> str:
    lines = "".join(
        f"<tr><td style='padding:4px 8px'>{l['label']}</td>"
        f"<td style='padding:4px 8px;text-align:right'>{l['amount']:.2f} €</td></tr>"
        for l in r["lines"])
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;color:#1C1917">
      <h2 style="margin-bottom:2px">{shop}</h2>
      <p style="color:#57534E;margin-top:0">Ticket n° {r['number']} — {r['date'][:10]}</p>
      <table style="width:100%;border-collapse:collapse">{lines}</table>
      <hr style="border:none;border-top:1px solid #E7E1D5">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:2px 8px">Total HT</td><td style="text-align:right;padding:2px 8px">{r['total_ht']:.2f} €</td></tr>
        <tr><td style="padding:2px 8px">TVA ({r['vat_rate']:g} %)</td><td style="text-align:right;padding:2px 8px">{r['total_vat']:.2f} €</td></tr>
        <tr><td style="padding:2px 8px"><b>Total TTC</b></td><td style="text-align:right;padding:2px 8px"><b>{r['total_ttc']:.2f} €</b></td></tr>
      </table>
      <p style="color:#8B8680;font-size:12px">Ticket numérique envoyé par {shop} via FidClic.
      Conservez cet email comme preuve d'achat.</p>
    </div>"""


@router.post("/api/owner/receipts")
def create_receipt(body: Dict[str, Any],
                   token_data=Depends(require_role(["business_owner", "manager"]))):
    """Create + send a digital receipt for one B2C sale.

    body: {amount_ttc, vat_rate?=20, label?, customer_id? | email?}
    Delivery: email (if an address is known) + web-push (if the customer has
    one registered — same rail as offers). Both are best-effort; the receipt
    is stored regardless and can be re-sent.
    """
    t = _tenant(token_data)
    ttc = round(float(body.get("amount_ttc") or 0), 2)
    if ttc <= 0:
        raise HTTPException(422, "Montant TTC requis (> 0).")
    try:
        rate = float(body.get("vat_rate", 20))
    except (TypeError, ValueError):
        rate = 20.0
    ht = round(ttc / (1 + rate / 100.0), 2)
    vat = round(ttc - ht, 2)
    label = (body.get("label") or "Achat en magasin").strip()[:120]

    # resolve the customer (optional) — gives us email + push channel
    customer = None
    email = (body.get("email") or "").strip().lower()
    if body.get("customer_id"):
        customer = _db.customers.find_one({"id": body["customer_id"],
                                           "tenant_id": t["id"]})
        if customer and not email:
            email = (customer.get("email") or "").strip().lower()

    seq = _db.receipts.count_documents({"tenant_id": t["id"]}) + 1
    rec = {
        "id": str(uuid4()), "tenant_id": t["id"],
        "number": f"TKT-{datetime.now().strftime('%Y%m')}-{seq:05d}",
        "date": _now(), "label": label,
        "lines": [{"label": label, "amount": ttc}],
        "total_ht": ht, "total_vat": vat, "total_ttc": ttc, "vat_rate": rate,
        "customer_id": (customer or {}).get("id"), "email": email or None,
        "delivery": {"email": False, "push": False},
        "created_at": _now(),
    }

    shop = t.get("name") or t.get("legal_name") or "Votre commerçant"
    # email (best-effort)
    if email:
        try:
            from services import mailer
            res = mailer.send(to=email, subject=f"Votre ticket — {shop} ({ttc:.2f} €)",
                              html=_receipt_html(shop, rec))
            rec["delivery"]["email"] = bool(res.get("sent"))
        except Exception:
            pass
    # push on the offers rail (best-effort)
    if customer:
        try:
            from services import web_push
            for sub in _db.push_subscriptions.find({"customer_id": customer["id"]}):
                web_push.send_push(sub.get("subscription") or sub,
                                   f"Ticket — {shop}",
                                   f"{label} : {ttc:.2f} € TTC. Merci !")
                rec["delivery"]["push"] = True
        except Exception:
            pass

    _db.receipts.insert_one(dict(rec))
    rec.pop("_id", None)
    try:
        from features import audit
        audit.log("receipt.sent", tenant_id=t["id"], actor=token_data,
                  object_kind="receipt", object_id=rec["id"],
                  after={"ttc": ttc, "email": rec["delivery"]["email"],
                         "push": rec["delivery"]["push"]})
    except Exception:
        pass
    return {"ok": True, "receipt": rec}


@router.get("/api/owner/receipts")
def list_receipts(token_data=Depends(require_role(["business_owner", "manager"]))):
    t = _tenant(token_data)
    out = []
    for r in _db.receipts.find({"tenant_id": t["id"]}).sort("created_at", -1).limit(200):
        r.pop("_id", None)
        out.append(r)
    return {"receipts": out}
