"""
PdpConnector — the single, PA-agnostic gateway for French e-invoicing.
==================================================================

WHY THIS FILE EXISTS
--------------------
FidClic's "Facturation" module never talks to a Plateforme Agréée (PA)
directly. It talks ONLY to the abstract `PdpConnector` below. Today the
connector is backed by B2Brouter (or a Mock for local dev/testing); if we
ever switch to SUPER PDP / Iopole, we swap ONE adapter class and change one
env var — the rest of the app (endpoints, screens, Fiscal Shield) never
changes. This is the "universal remote" pattern: the app presses the same
buttons; only the TV behind them changes.

WHAT LIVES HERE
---------------
1. A normalized status vocabulary (`InvoiceState`) so the app never sees a
   vendor's raw codes (B2Brouter's 200/202/205/210/212, Iopole's, etc.).
2. The abstract `PdpConnector` interface — every method the app can call.
3. `MockPdp` — an in-memory fake PA for dev + for testing the cases the
   B2Brouter *sandbox cannot* (rejection, duplicate, network failure).
4. `B2BrouterPdp` — the real adapter (urllib, stdlib only — no new deps).
5. `IdempotencyGuard` — duplicate-send protection that lives ABOVE the
   connector, so it works no matter which PA we use (B2Brouter does not
   document a single-invoice idempotency key — verified 2026-07).
6. `get_pdp_connector()` — factory that picks Mock vs B2Brouter from env.

CONVENTIONS (match the rest of the codebase)
--------------------------------------------
- Stdlib HTTP only (urllib) — Vercel Python function, no extra requirements.
- No import of server.py (keep this leaf-level and safe; the live platform
  cannot break from adding this file).
- Every public method returns a plain dict; errors are raised as
  `PdpError` with a machine code + human message the UI can show.

ENV VARS (set in Vercel)
------------------------
  PDP_PROVIDER            "mock" (default) | "b2brouter"
  B2BROUTER_API_KEY       test_... (sandbox) or prod_...
  B2BROUTER_API_VERSION   default "2026-03-02" (min for DGFiP)
  B2BROUTER_BASE_URL      default "https://api.b2brouter.net"
  B2BROUTER_WEBHOOK_SECRET  shared secret for webhook HMAC verification
"""

from __future__ import annotations

import os
import json
import hmac
import time
import uuid
import hashlib
import urllib.request
import urllib.error
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List


# ---------------------------------------------------------------------------
# 1. Normalized vocabulary — the app ONLY ever sees these values.
# ---------------------------------------------------------------------------

class InvoiceState:
    """PA-agnostic lifecycle states. Adapters map vendor codes → these."""
    DRAFT = "draft"          # created, not sent
    SENT = "sent"            # handed to the PA / deposited (DGFiP 200)
    RECEIVED = "received"    # reached recipient PA (DGFiP 202)
    ACCEPTED = "accepted"    # buyer approved (DGFiP 205)
    REFUSED = "refused"      # buyer rejected (DGFiP 210)
    PAID = "paid"            # payment recorded (DGFiP 212)
    ERROR = "error"          # transmission/validation error


# B2Brouter raw state -> our normalized state.
_B2B_STATE_MAP = {
    "new": InvoiceState.DRAFT,
    "draft": InvoiceState.DRAFT,
    "sent": InvoiceState.SENT,
    "registered": InvoiceState.RECEIVED,
    "accepted": InvoiceState.ACCEPTED,
    "approved": InvoiceState.ACCEPTED,
    "refused": InvoiceState.REFUSED,
    "rejected": InvoiceState.REFUSED,
    "paid": InvoiceState.PAID,
    "error": InvoiceState.ERROR,
}


class PdpError(Exception):
    """Raised on any PA failure. `code` is machine-readable, `message` human."""
    def __init__(self, code: str, message: str, http_status: Optional[int] = None):
        self.code = code
        self.message = message
        self.http_status = http_status
        super().__init__(f"[{code}] {message}")


# ---------------------------------------------------------------------------
# 2. The interface — every method the Facturation module is allowed to call.
# ---------------------------------------------------------------------------

class PdpConnector(ABC):
    """Abstract gateway. The app depends on THIS, never on a concrete PA."""

    # --- issuing ---
    @abstractmethod
    def create_invoice(self, account_id: str, invoice: Dict[str, Any]) -> Dict[str, Any]:
        """Create a draft invoice from our normalized JSON. Returns {id, state}."""

    @abstractmethod
    def validate(self, invoice_id: str) -> Dict[str, Any]:
        """Check format/rules before sending. Returns {valid: bool, errors: []}."""

    @abstractmethod
    def send(self, invoice_id: str) -> Dict[str, Any]:
        """Transmit the invoice. Returns {id, state}."""

    @abstractmethod
    def get_status(self, invoice_id: str) -> Dict[str, Any]:
        """Poll current lifecycle state. Returns {id, state}."""

    @abstractmethod
    def mark_state(self, invoice_id: str, state: str) -> Dict[str, Any]:
        """Set a state we control (e.g. accept/refuse a received invoice, mark paid)."""

    # --- receiving ---
    @abstractmethod
    def list_received(self, account_id: str) -> List[Dict[str, Any]]:
        """Supplier invoices that arrived for this account."""

    # --- e-reporting (B2C / cross-border) ---
    @abstractmethod
    def send_ereporting(self, account_id: str, report: Dict[str, Any]) -> Dict[str, Any]:
        """Push a B2C/simplified transaction into the daily ledger."""

    # --- directory / annuaire ---
    @abstractmethod
    def lookup_directory(self, country: str, identifier: str) -> Dict[str, Any]:
        """Find a buyer's routing info. May be async (returns {pending: true})."""

    # --- compliance activation (France DGFiP) ---
    @abstractmethod
    def activate_compliance(self, account_id: str, settings: Dict[str, Any]) -> Dict[str, Any]:
        """Register the company in the PPF Annuaire + create the DGFiP tax-report setting."""

    # --- webhooks ---
    @abstractmethod
    def verify_webhook(self, headers: Dict[str, str], raw_body: bytes) -> bool:
        """Confirm an incoming webhook truly came from the PA (signature check)."""


# ---------------------------------------------------------------------------
# 3. MockPdp — in-memory fake PA. Dev + tests the sandbox can't do.
# ---------------------------------------------------------------------------

class MockPdp(PdpConnector):
    """
    A fake PA that lives entirely in memory. Two jobs:
      - let us build & run the whole Facturation module with NO account/SIREN;
      - simulate the failure paths the B2Brouter sandbox refuses to (rejection,
        duplicate, network timeout) so Fiscal-Shield/rejection-UX gets tested.

    Test hooks (set on the instance):
      force_next_send = "refused" | "error" | "timeout"  -> next send() behaves so
    """

    def __init__(self):
        self._invoices: Dict[str, Dict[str, Any]] = {}
        self._received: Dict[str, List[Dict[str, Any]]] = {}
        self.force_next_send: Optional[str] = None  # test hook
        self.provider: str = "mock"
        self.placeholder: bool = False

    def create_invoice(self, account_id, invoice):
        inv_id = "mock-" + uuid.uuid4().hex[:12]
        rec = {"id": inv_id, "account_id": account_id, "state": InvoiceState.DRAFT,
               "invoice": invoice, "created_at": time.time()}
        self._invoices[inv_id] = rec
        return {"id": inv_id, "state": InvoiceState.DRAFT}

    def validate(self, invoice_id):
        inv = self._invoices.get(invoice_id)
        if not inv:
            raise PdpError("resource_missing", "Invoice not found", 404)
        errors = []
        data = inv["invoice"]
        # Minimal example rules — extend to mirror AFNOR checks later.
        if not data.get("lines"):
            errors.append("no_lines: invoice has no lines")
        if data.get("buyer", {}).get("siren") in (None, "", "000000000"):
            errors.append("bad_siren: buyer SIREN missing/invalid")
        return {"valid": len(errors) == 0, "errors": errors}

    def send(self, invoice_id):
        inv = self._invoices.get(invoice_id)
        if not inv:
            raise PdpError("resource_missing", "Invoice not found", 404)
        # --- test hooks: simulate what the sandbox won't ---
        hook, self.force_next_send = self.force_next_send, None
        if hook == "timeout":
            raise PdpError("network_timeout", "Simulated network timeout", None)
        if hook == "error":
            inv["state"] = InvoiceState.ERROR
            return {"id": invoice_id, "state": InvoiceState.ERROR,
                    "reject_code": "SYNTAX_ERR",
                    "reject_reason": "Format de facture invalide (simulé)"}
        if hook == "refused":
            inv["state"] = InvoiceState.REFUSED
            return {"id": invoice_id, "state": InvoiceState.REFUSED,
                    "reject_code": "ADR_ERR",
                    "reject_reason": "SIREN de l'acheteur introuvable dans l'annuaire (simulé)"}
        inv["state"] = InvoiceState.SENT
        return {"id": invoice_id, "state": InvoiceState.SENT}

    def get_status(self, invoice_id):
        inv = self._invoices.get(invoice_id)
        if not inv:
            raise PdpError("resource_missing", "Invoice not found", 404)
        return {"id": invoice_id, "state": inv["state"]}

    def mark_state(self, invoice_id, state):
        inv = self._invoices.get(invoice_id)
        if not inv:
            raise PdpError("resource_missing", "Invoice not found", 404)
        inv["state"] = state
        return {"id": invoice_id, "state": state}

    def list_received(self, account_id):
        return self._received.get(account_id, [])

    def send_ereporting(self, account_id, report):
        return {"id": "mock-ledger-" + uuid.uuid4().hex[:8], "state": "queued"}

    def lookup_directory(self, country, identifier):
        # Pretend everyone with a 9-digit SIREN is found on Peppol 0225.
        found = country == "fr" and len(str(identifier)) in (9, 14)
        return {"found": found, "transport": "peppol", "scheme": "0225"} if found \
            else {"found": False}

    def activate_compliance(self, account_id, settings):
        return {"status": "registered", "annuaire": "ok",
                "note": "Mock: annuaire propagation instant (real B2Brouter = up to 24h)"}

    def verify_webhook(self, headers, raw_body):
        return True  # Mock trusts everything

    # test helper: inject a supplier invoice into a client's inbox
    def _seed_received(self, account_id, invoice):
        rec = {"id": "mock-rcv-" + uuid.uuid4().hex[:8], "state": InvoiceState.RECEIVED,
               "invoice": invoice}
        self._received.setdefault(account_id, []).append(rec)
        return rec


# ---------------------------------------------------------------------------
# 4. B2BrouterPdp — the real adapter (stdlib urllib only).
# ---------------------------------------------------------------------------

class B2BrouterPdp(PdpConnector):
    """
    Talks to the real B2Brouter API. Sandbox vs production is decided purely by
    the API key prefix (test_ -> sandbox, prod_ -> production), same base URL.
    All B2Brouter-specific quirks (endpoints, state names, headers) are hidden
    here so the rest of the app stays PA-agnostic.
    """

    def __init__(self, api_key: str, api_version: str, base_url: str, webhook_secret: str = ""):
        self.api_key = api_key
        self.api_version = api_version
        self.base_url = base_url.rstrip("/")
        self.webhook_secret = webhook_secret
        self.provider: str = "b2brouter"
        self.placeholder: bool = False

    # -- low-level HTTP (urllib, stdlib) --
    def _request(self, method: str, path: str, body: Optional[dict] = None) -> Any:
        url = self.base_url + path
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("X-B2B-API-Key", self.api_key)
        req.add_header("X-B2B-API-Version", self.api_version)
        req.add_header("Accept", "application/json")
        if data is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode() or "{}"
                return json.loads(raw)
        except urllib.error.HTTPError as e:
            payload = {}
            try:
                payload = json.loads(e.read().decode() or "{}")
            except Exception:
                pass
            err = payload.get("error", {})
            code = err.get("code") if isinstance(err, dict) else str(err)
            msg = err.get("message") if isinstance(err, dict) else str(err)
            raise PdpError(code or "http_error", msg or f"HTTP {e.code}", e.code)
        except urllib.error.URLError as e:
            raise PdpError("network_error", f"Network error: {e.reason}", None)

    @staticmethod
    def _norm_state(raw: Optional[str]) -> str:
        return _B2B_STATE_MAP.get((raw or "").lower(), InvoiceState.ERROR)

    def create_invoice(self, account_id, invoice):
        # `invoice` is expected to already be in B2Brouter's JSON shape
        # (the endpoint layer maps our normalized invoice -> this shape).
        r = self._request("POST", f"/accounts/{account_id}/invoices",
                          {"invoice": {**invoice, "send_after_import": False}})
        inv = r.get("invoice", r)
        return {"id": inv.get("id"), "state": self._norm_state(inv.get("state"))}

    def validate(self, invoice_id):
        r = self._request("GET", f"/invoices/{invoice_id}/validate")
        # B2Brouter returns validation detail; normalize to valid/errors.
        errors = r.get("errors") or []
        return {"valid": len(errors) == 0, "errors": errors}

    def send(self, invoice_id):
        r = self._request("POST", f"/invoices/send_invoice/{invoice_id}")
        inv = r.get("invoice", r)
        return {"id": invoice_id, "state": self._norm_state(inv.get("state"))}

    def get_status(self, invoice_id):
        r = self._request("GET", f"/invoices/{invoice_id}?include=lines")
        inv = r.get("invoice", r)
        return {"id": invoice_id, "state": self._norm_state(inv.get("state"))}

    def mark_state(self, invoice_id, state):
        # our state -> B2Brouter's mark_as vocabulary
        b2b = {InvoiceState.ACCEPTED: "accepted", InvoiceState.REFUSED: "refused",
               InvoiceState.PAID: "paid"}.get(state, state)
        self._request("POST", f"/invoices/{invoice_id}/mark_as", {"state": b2b})
        return {"id": invoice_id, "state": state}

    def list_received(self, account_id):
        r = self._request("GET", f"/accounts/{account_id}/invoices?type=ReceivedInvoice")
        return r.get("invoices", r if isinstance(r, list) else [])

    def send_ereporting(self, account_id, report):
        # B2C simplified invoice -> daily ledger (Flux 10)
        payload = {"invoice": {**report, "type": "IssuedSimplifiedInvoice",
                               "send_after_import": True}}
        r = self._request("POST", f"/accounts/{account_id}/invoices", payload)
        inv = r.get("invoice", r)
        return {"id": inv.get("id"), "state": "queued"}

    def lookup_directory(self, country, identifier):
        # France: scheme 0009 = SIRET. Async: may return 202 + polling url.
        r = self._request("GET", f"/directory/{country}/0009/{identifier}")
        if r.get("polling_url"):
            return {"pending": True, "polling_url": r["polling_url"]}
        return {"found": True, **r}

    def activate_compliance(self, account_id, settings):
        # settings = {code:"dgfip", start_date, type_operation, naf_code, enterprise_size, ...}
        r = self._request("POST", f"/accounts/{account_id}/tax_report_settings",
                          {"tax_report_setting": {"code": "dgfip", **settings}})
        return {"status": "registered", "raw": r,
                "note": "Annuaire propagation can take up to 24h (DGFiP)."}

    def verify_webhook(self, headers, raw_body):
        # Header: X-B2Brouter-Signature: t=<ts>,s=<hmac_sha256 hex>
        sig = headers.get("X-B2Brouter-Signature") or headers.get("x-b2brouter-signature")
        if not sig or not self.webhook_secret:
            return False
        parts = dict(p.split("=", 1) for p in sig.split(",") if "=" in p)
        ts, s = parts.get("t"), parts.get("s")
        if not ts or not s:
            return False
        payload = f"{ts}.".encode() + raw_body
        computed = hmac.new(self.webhook_secret.encode(), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(computed, s)


# ---------------------------------------------------------------------------
# 5. IdempotencyGuard — duplicate-send protection, PA-independent.
# ---------------------------------------------------------------------------

class IdempotencyGuard:
    """
    Prevents the same invoice being sent twice (network retries, double clicks).
    Lives ABOVE the connector so it works with ANY PA — B2Brouter does not offer
    a single-invoice idempotency key (verified 2026-07). Persist `seen` in Mongo
    in the endpoint layer; this in-memory version is for tests.

    Usage:
        if guard.already_sent(key): return cached
        result = connector.send(id); guard.mark_sent(key, result)
    """
    def __init__(self):
        self._seen: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def make_key(tenant_id: str, invoice_number: str) -> str:
        return f"{tenant_id}:{invoice_number}"

    def already_sent(self, key: str) -> Optional[Dict[str, Any]]:
        return self._seen.get(key)

    def mark_sent(self, key: str, result: Dict[str, Any]) -> None:
        self._seen[key] = result


# ---------------------------------------------------------------------------
# 6. Factory — one place decides which PA backs the app.
# ---------------------------------------------------------------------------

_singleton: Optional[PdpConnector] = None
_tenant_instances: Dict[str, PdpConnector] = {}   # provider name -> connector

# Which PAs FidClic knows how to route to. "mock" and "b2brouter" have real
# adapters; any other name (iopole, pennylane, ...) is accepted for routing and
# backed by a labelled Mock until its concrete adapter is dropped in — the app
# stays PA-agnostic, so adding a real adapter is a one-class change here.
KNOWN_PROVIDERS = ["b2brouter", "iopole", "pennylane", "mock"]


def _build(provider: str) -> PdpConnector:
    """Construct one connector for a given PA provider name (Multi-PA core)."""
    provider = (provider or "mock").lower()
    if provider == "b2brouter":
        key = os.environ.get("B2BROUTER_API_KEY", "")
        if key:
            c: PdpConnector = B2BrouterPdp(
                api_key=key,
                api_version=os.environ.get("B2BROUTER_API_VERSION", "2026-03-02"),
                base_url=os.environ.get("B2BROUTER_BASE_URL", "https://api.b2brouter.net"),
                webhook_secret=os.environ.get("B2BROUTER_WEBHOOK_SECRET", ""),
            )
            c.provider = "b2brouter"
            return c
        c = MockPdp(); c.provider = "b2brouter"; c.placeholder = True
        return c  # safe fallback: no key -> Mock, never crash
    if provider == "mock":
        c = MockPdp(); c.provider = "mock"; c.placeholder = False
        return c
    # Any other named PA: accepted for per-client routing. Backed by a labelled
    # Mock until we integrate that vendor's real adapter (env {PROVIDER}_API_KEY).
    c = MockPdp(); c.provider = provider
    c.placeholder = not bool(os.environ.get(provider.upper() + "_API_KEY", ""))
    return c


def _tenant_provider(tenant) -> Optional[str]:
    if tenant is None:
        return None
    if isinstance(tenant, dict):
        p = tenant.get("pdp_provider")
    else:
        p = getattr(tenant, "pdp_provider", None)
    return (p or "").lower() or None


def get_pdp_connector(tenant=None) -> PdpConnector:
    """
    Return the connector for a given client (tenant) — the Multi-PA router.

    - If the tenant declares its own `pdp_provider` (Client A -> b2brouter,
      Client B -> iopole, ...), route to THAT PA (cached per provider). This is
      Model B: one cabinet, clients on any platform.
    - Otherwise fall back to the app default from env (PDP_PROVIDER, default
      "mock") — unchanged legacy behaviour, backward compatible.
    """
    global _singleton
    prov = _tenant_provider(tenant)
    if prov:
        if prov not in _tenant_instances:
            _tenant_instances[prov] = _build(prov)
        return _tenant_instances[prov]
    if _singleton is not None:
        return _singleton
    _singleton = _build(os.environ.get("PDP_PROVIDER") or "mock")
    return _singleton


def reset_pdp_connector() -> None:
    """Test helper — clears every cached connector so env/config changes apply."""
    global _singleton
    _singleton = None
    _tenant_instances.clear()
