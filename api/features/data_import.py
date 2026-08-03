"""
Imports — bring a cabinet's existing world into FidClic in minutes.

Status: 🟢 Core.
Mounts at: /api/cabinet/import/clients,
           /api/cabinet/dossiers/{tid}/import/invoices,
           /api/cabinet/dossiers/{tid}/import/bank
Storage: writes tenants + cabinet_links (via cabinet_os), fact_invoices,
         bank_transactions.

WHY THIS EXISTS
    A 45-client cabinet won't type 45 dossiers by hand, and it has years of
    history in Sage/Cegid. Three importers remove that friction:
      1. Clients (CSV)   — raison sociale, SIREN, email, PA → dossiers+mandats+PA
      2. Invoices (CSV or FEC) — past sales become fact_invoices (validated)
      3. Bank (CSV or OFX)     — encaissements → bank_transactions (feeds Lettrage)
    Each importer is tolerant (accepts French/English headers), reports per-row
    errors, and never half-creates on a bad row.
"""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from auth import require_role

router = APIRouter(tags=["import"])
_db = None


def init(db):
    global _db
    _db = db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _num(x) -> float:
    if x is None:
        return 0.0
    s = re.sub(r"[^\d,.\-]", "", str(x)).replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def _iso_date(x: str) -> str:
    """Accept YYYY-MM-DD, DD/MM/YYYY, or YYYYMMDD → YYYY-MM-DD."""
    s = (x or "").strip()
    if re.fullmatch(r"\d{8}", s):
        return f"{s[:4]}-{s[4:6]}-{s[6:]}"
    m = re.fullmatch(r"(\d{1,2})[/.](\d{1,2})[/.](\d{4})", s)
    if m:
        return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    return s[:10]


def _rows(content: str) -> List[Dict[str, str]]:
    """Parse CSV text into dicts with lowercased/trimmed header keys.
    Auto-detects ',' or ';' (French Excel uses ';')."""
    text = (content or "").strip()
    if not text:
        return []
    delim = ";" if text.splitlines()[0].count(";") > text.splitlines()[0].count(",") else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delim)
    out = []
    for r in reader:
        out.append({(k or "").strip().lower(): (v or "").strip() for k, v in r.items()})
    return out


def _pick(row: Dict[str, str], *names) -> str:
    for n in names:
        if n in row and row[n]:
            return row[n]
    return ""


# ==========================================================================
# 1. Clients (CSV)
# ==========================================================================

@router.post("/api/cabinet/import/clients")
def import_clients(body: Dict[str, Any],
                   token_data=Depends(require_role(["comptable"]))):
    """Bulk-onboard clients. Reuses the S6 create-client logic per row so
    mandate, SIREN validation and dedupe are identical to manual onboarding."""
    from features import cabinet_os as co
    rows = _rows(body.get("content", ""))
    if not rows:
        raise HTTPException(422, "Fichier vide ou illisible.")
    created, errors = [], []
    for i, row in enumerate(rows, start=2):  # row 1 = header
        name = _pick(row, "raison sociale", "raison_sociale", "legal_name", "nom", "name")
        siren = _pick(row, "siren")
        email = _pick(row, "email", "client_email", "e-mail")
        pa = _pick(row, "pa", "plateforme", "provider", "pdp", "pdp_provider").lower()
        try:
            res = co.create_client_dossier(
                {"legal_name": name, "siren": siren,
                 "client_email": email or None}, token_data=token_data)
            tid = (res.get("tenant") or {}).get("id") or res.get("tenant_id")
            if not tid:  # fallback: locate by siren
                t = _db.tenants.find_one({"siren": re.sub(r"\D", "", siren)})
                tid = t["id"] if t else None
            if pa and tid:
                _db.tenants.update_one({"id": tid}, {"$set": {"pdp_provider": pa}})
            created.append({"name": name, "siren": siren, "pa": pa or "(défaut)"})
        except HTTPException as e:
            errors.append({"row": i, "name": name, "error": e.detail})
        except Exception as e:  # noqa: BLE001
            errors.append({"row": i, "name": name, "error": str(e)[:120]})
    return {"ok": True, "created": len(created), "clients": created,
            "skipped": len(errors), "errors": errors}


# ==========================================================================
# 2. Invoices (CSV or FEC)
# ==========================================================================

def _invoice_from_csv_row(tid: str, row: Dict[str, str]) -> Dict[str, Any]:
    ht = _num(_pick(row, "ht", "total_ht", "montant_ht", "montant ht"))
    ttc = _num(_pick(row, "ttc", "total_ttc", "montant_ttc", "montant ttc"))
    rate = _num(_pick(row, "vat_rate", "tva", "taux_tva", "taux tva")) or 20.0
    if ht and not ttc:
        vat = round(ht * rate / 100.0, 2); ttc = round(ht + vat, 2)
    elif ttc and not ht:
        ht = round(ttc / (1 + rate / 100.0), 2); vat = round(ttc - ht, 2)
    else:
        vat = round(ttc - ht, 2)
    return {
        "id": str(uuid4()), "tenant_id": tid,
        "number": _pick(row, "number", "numero", "numéro", "num") or None,
        "date": _iso_date(_pick(row, "date", "date_facture")),
        "buyer": {"name": _pick(row, "client", "client_name", "buyer", "acheteur") or "Client",
                  "siren": re.sub(r"\D", "", _pick(row, "client_siren", "siren")),
                  "is_company": True},
        "lines": [{"description": "Import", "quantity": 1, "unit_price": ht,
                   "vat_rate": rate, "line_total_ht": ht}],
        "total_ht": round(ht, 2), "total_vat": round(vat, 2), "total_ttc": round(ttc, 2),
        "review_status": "validated", "payment_status": "unpaid",
        "pa_status": "imported", "source": "import", "created_at": _now(),
    }


def _invoices_from_fec(tid: str, content: str) -> List[Dict[str, Any]]:
    """Reconstruct sales invoices from a FEC (reverse of our export): group
    the VE journal by EcritureNum, read 411 (débit=TTC), 707 (crédit=HT),
    445 (crédit=TVA)."""
    lines = [l for l in content.splitlines() if l.strip()]
    if not lines:
        return []
    header = lines[0].split("\t")
    idx = {c: i for i, c in enumerate(header)}
    need = ["EcritureNum", "CompteNum", "PieceRef", "PieceDate", "Debit", "Credit",
            "CompAuxNum", "CompAuxLib"]
    if not all(c in idx for c in need):
        raise HTTPException(422, "FEC invalide : colonnes manquantes.")
    groups: Dict[str, Dict[str, Any]] = {}
    for ln in lines[1:]:
        c = ln.split("\t")
        if len(c) < len(header):
            continue
        ecr = c[idx["EcritureNum"]]
        g = groups.setdefault(ecr, {"ttc": 0.0, "ht": 0.0, "vat": 0.0,
                                    "ref": c[idx["PieceRef"]], "date": c[idx["PieceDate"]],
                                    "client": c[idx["CompAuxLib"]], "siren": c[idx["CompAuxNum"]]})
        acct = c[idx["CompteNum"]]
        deb = _num(c[idx["Debit"]]); cre = _num(c[idx["Credit"]])
        if acct.startswith("411"):
            g["ttc"] += deb
        elif acct.startswith("707") or acct.startswith("70"):
            g["ht"] += cre
        elif acct.startswith("445"):
            g["vat"] += cre
    out = []
    for ecr, g in groups.items():
        out.append({
            "id": str(uuid4()), "tenant_id": tid, "number": g["ref"] or ecr,
            "date": _iso_date(g["date"]),
            "buyer": {"name": g["client"] or "Client",
                      "siren": re.sub(r"\D", "", g["siren"]), "is_company": True},
            "lines": [{"description": "Import FEC", "quantity": 1,
                       "unit_price": round(g["ht"], 2), "vat_rate": 20,
                       "line_total_ht": round(g["ht"], 2)}],
            "total_ht": round(g["ht"], 2), "total_vat": round(g["vat"], 2),
            "total_ttc": round(g["ttc"], 2),
            "review_status": "validated", "payment_status": "unpaid",
            "pa_status": "imported", "source": "import_fec", "created_at": _now(),
        })
    return out


@router.post("/api/cabinet/dossiers/{tenant_id}/import/invoices")
def import_invoices(tenant_id: str, body: Dict[str, Any],
                    token_data=Depends(require_role(["comptable"]))):
    from features import cabinet_os as co
    co.assert_can_see_tenant(token_data.email, tenant_id)
    content = body.get("content", "")
    fmt = (body.get("format") or "").lower()
    if fmt == "fec" or ("\t" in content and "EcritureNum" in content):
        invoices = _invoices_from_fec(tenant_id, content)
    else:
        rows = _rows(content)
        if not rows:
            raise HTTPException(422, "Fichier vide ou illisible.")
        invoices = [_invoice_from_csv_row(tenant_id, r) for r in rows]
    for inv in invoices:
        _db.fact_invoices.insert_one(dict(inv))
    try:
        from features import audit
        audit.log("facturation.imported", tenant_id=tenant_id, actor=token_data,
                  object_kind="tenant", object_id=tenant_id,
                  after={"invoices": len(invoices), "format": fmt or "csv"})
    except Exception:
        pass
    return {"ok": True, "imported": len(invoices)}


# ==========================================================================
# 3. Bank transactions (CSV or OFX)
# ==========================================================================

def _bank_from_ofx(content: str) -> List[Dict[str, str]]:
    out = []
    for blk in re.findall(r"<STMTTRN>(.*?)</STMTTRN>", content, re.DOTALL | re.IGNORECASE):
        def g(tag):
            m = re.search(rf"<{tag}>([^<\r\n]+)", blk, re.IGNORECASE)
            return m.group(1).strip() if m else ""
        out.append({"date": _iso_date(g("DTPOSTED")[:8]), "amount": _num(g("TRNAMT")),
                    "label": g("NAME") or g("MEMO"), "reference": g("FITID")})
    return out


@router.post("/api/cabinet/dossiers/{tenant_id}/import/bank")
def import_bank(tenant_id: str, body: Dict[str, Any],
                token_data=Depends(require_role(["comptable"]))):
    from features import cabinet_os as co
    co.assert_can_see_tenant(token_data.email, tenant_id)
    m = co.current_membership(token_data.email)
    content = body.get("content", "")
    fmt = (body.get("format") or "").lower()
    if fmt == "ofx" or "<STMTTRN>" in content.upper():
        items = _bank_from_ofx(content)
    else:
        items = []
        for row in _rows(content):
            items.append({"date": _iso_date(_pick(row, "date")),
                          "amount": _num(_pick(row, "amount", "montant", "credit", "crédit")),
                          "label": _pick(row, "label", "libelle", "libellé", "description"),
                          "reference": _pick(row, "reference", "référence", "ref", "communication")})
    if not items:
        raise HTTPException(422, "Aucune transaction lisible.")
    for it in items:
        _db.bank_transactions.insert_one({
            "id": str(uuid4()), "tenant_id": tenant_id, "cabinet_id": m["cabinet_id"],
            "date": it["date"], "amount": round(float(it["amount"] or 0), 2),
            "label": it["label"] or "Transaction", "reference": it["reference"] or "",
            "matched": False, "source": "import", "created_at": _now()})
    return {"ok": True, "imported": len(items)}
