"""
Coefficients sectoriels — la « reconstitution simulée » (le contrôle que ferait
la DGFiP, avant elle).

Status: 🟢 Core.
Mounts at: /api/cabinet/coefficients*, used by facturation.compute_bouclier.
Storage: cabinet_coefficients.

WHY THIS EXISTS (terrain, août 2026)
    In a tax audit the administration RECONSTRUCTS a shop's revenue from its
    purchases: achats × coefficient sectoriel = CA attendu. If declared sales
    fall far below that range, the gap is presumed undeclared (often cash)
    sales. Post-2026 the DGFiP sees purchases automatically (e-invoicing) and
    card revenue via banks — this cross-check becomes systematic.
    FidClic runs THE SAME math first, so the cabinet can fix honest mistakes
    (a forgotten caisse export) and warn risky clients — with data, not
    accusations. We never compute "how much cash to declare"; we show what an
    inspector would reconstruct. The only compliant number is 100%.

TWO SOURCES, BEST WINS
    1. LEARNED (per cabinet): the median ventes/achats ratio of the cabinet's
       OWN dossiers per NAF prefix — real local numbers (Tours, not a national
       average). Deterministic statistics (median), deliberately NOT ML:
       explainable, auditable, works from a handful of dossiers.
    2. DEFAULTS (national, order-of-magnitude): a small table by NAF prefix,
       used until the cabinet has learned its own.
    A per-dossier override (tenant.coefficient_override = [min, max]) beats both.
"""
from __future__ import annotations

from datetime import datetime, timezone
from statistics import median
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends
from auth import require_role

router = APIRouter(tags=["coefficients"])
_db = None

# (NAF prefixes, label, coef_min, coef_max) — CA TTC attendu = achats TTC × coef.
# Order matters: first match wins (longest/most specific prefixes first).
DEFAULTS: List[Tuple[Tuple[str, ...], str, float, float]] = [
    (("1071", "4724"), "Boulangerie-pâtisserie", 3.0, 3.5),
    (("4722", "4723"), "Boucherie / poissonnerie", 2.0, 2.4),
    (("5610", "5629"), "Restauration", 3.5, 4.5),
    (("5630",), "Bars / débits de boissons", 4.0, 5.0),
    (("4711",), "Épicerie / supérette", 1.25, 1.4),
    (("9602",), "Coiffure / soins", 6.0, 10.0),   # achats faibles, main-d'œuvre
    (("4520",), "Garage / entretien auto", 1.8, 2.4),
    (("47",), "Autres commerces de détail", 1.4, 1.9),
]

MIN_ACHATS = 500.0      # below this, ratios are noise
MIN_DOSSIERS = 3        # need at least 3 dossiers in a sector to "learn" it


def init(db):
    global _db
    _db = db
    try:
        _db.cabinet_coefficients.create_index([("cabinet_id", 1), ("naf_prefix", 1)])
    except Exception:
        pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _naf_norm(naf: Optional[str]) -> str:
    return "".join(ch for ch in str(naf or "") if ch.isalnum()).upper()


def default_coefficient(naf: Optional[str]) -> Optional[Dict[str, Any]]:
    n = _naf_norm(naf)
    if not n:
        return None
    for prefixes, label, cmin, cmax in DEFAULTS:
        if any(n.startswith(p) for p in prefixes):
            return {"label": label, "min": cmin, "max": cmax, "source": "défaut national"}
    return None


def _tenant_totals(db, tenant_id: str) -> Tuple[float, float]:
    achats = sum(float(r.get("total_ttc") or 0)
                 for r in db.fact_received_invoices.find({"tenant_id": tenant_id}))
    ventes = sum(float(i.get("total_ttc") or 0)
                 for i in db.fact_invoices.find({"tenant_id": tenant_id}))
    for er in db.fact_ereports.find({"tenant_id": tenant_id}):
        for v in (er.get("totals_by_vat") or {}).values():
            ventes += float(v or 0)
    return round(achats, 2), round(ventes, 2)


def learn(db, cabinet_id: str) -> Dict[str, Any]:
    """Compute the cabinet's own coefficients: median ventes/achats per NAF
    prefix (4 chars) across its dossiers. Pure statistics — explainable."""
    ratios: Dict[str, List[float]] = {}
    for link in db.cabinet_links.find({"cabinet_id": cabinet_id, "status": "active"}):
        t = db.tenants.find_one({"id": link["tenant_id"]}) or {}
        naf = _naf_norm(t.get("naf_code"))[:4]
        if not naf:
            continue
        achats, ventes = _tenant_totals(db, link["tenant_id"])
        if achats < MIN_ACHATS or ventes <= 0:
            continue
        ratios.setdefault(naf, []).append(ventes / achats)

    learned = 0
    for naf, vals in ratios.items():
        if len(vals) < MIN_DOSSIERS:
            continue
        med = median(vals)
        db.cabinet_coefficients.update_one(
            {"cabinet_id": cabinet_id, "naf_prefix": naf},
            {"$set": {"cabinet_id": cabinet_id, "naf_prefix": naf,
                      "coef_median": round(med, 2),
                      "coef_min": round(med * 0.8, 2),   # tolerance band ±20 %
                      "coef_max": round(med * 1.2, 2),
                      "dossiers": len(vals), "updated_at": _now()}},
            upsert=True)
        learned += 1
    return {"ok": True, "sectors_learned": learned,
            "sectors_seen": len(ratios),
            "note": f"médiane par NAF sur vos propres dossiers (≥{MIN_DOSSIERS} dossiers/secteur)"}


def coefficient_for(db, tenant: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Best coefficient for one dossier: override > learned (its cabinet) > default."""
    ov = tenant.get("coefficient_override")
    if isinstance(ov, (list, tuple)) and len(ov) == 2:
        return {"label": "réglé par le cabinet", "min": float(ov[0]), "max": float(ov[1]),
                "source": "réglage dossier"}
    naf4 = _naf_norm(tenant.get("naf_code"))[:4]
    if naf4:
        link = db.cabinet_links.find_one({"tenant_id": tenant["id"], "status": "active"})
        if link:
            row = db.cabinet_coefficients.find_one({"cabinet_id": link["cabinet_id"],
                                                    "naf_prefix": naf4})
            if row:
                return {"label": f"appris sur {row['dossiers']} de vos dossiers",
                        "min": row["coef_min"], "max": row["coef_max"],
                        "source": "appris cabinet"}
    return default_coefficient(tenant.get("naf_code"))


def reconstitution(db, tenant: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """The simulated audit: expected CA range from achats vs declared CA.
    Returns None when we can't say anything useful (no NAF, no data)."""
    coef = coefficient_for(db, tenant)
    if not coef:
        return None
    achats, declared = _tenant_totals(db, tenant["id"])
    if achats < MIN_ACHATS or declared <= 0:
        return None
    exp_min = round(achats * coef["min"], 2)
    exp_max = round(achats * coef["max"], 2)
    flag = declared < exp_min          # below the LOW end of the band → gap
    return {"achats": achats, "declared": declared,
            "expected_min": exp_min, "expected_max": exp_max,
            "gap": round(max(0.0, exp_min - declared), 2),
            "coefficient": coef, "flag": flag}


# ==========================================================================
# endpoints
# ==========================================================================

@router.post("/api/cabinet/coefficients/learn")
def learn_endpoint(token_data=Depends(require_role(["comptable"]))):
    from features import cabinet_os as co
    m = co.require_cabinet_role(token_data.email, co.ASSIGN_ROLES)
    return learn(_db, m["cabinet_id"])


@router.get("/api/cabinet/coefficients")
def list_coefficients(token_data=Depends(require_role(["comptable"]))):
    from features import cabinet_os as co
    m = co.current_membership(token_data.email)
    learned = []
    for r in _db.cabinet_coefficients.find({"cabinet_id": m["cabinet_id"]}):
        r.pop("_id", None)
        learned.append(r)
    return {"learned": learned,
            "defaults": [{"prefixes": list(p), "label": l, "min": a, "max": b}
                         for p, l, a, b in DEFAULTS]}
