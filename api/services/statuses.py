"""
Four independent status families for an invoice (S1 refactor).

Status: 🟢 Core — everything downstream depends on this.

WHY THIS EXISTS
    An invoice lives four separate lives at the same time, and squeezing them
    into one `state` field made impossible states unrepresentable:

      1. pa_status      — where it is in the PA/PPF pipe        (sent, refused…)
      2. review_status  — what the accountant said about it     (validated…)
      3. payment_status — whether the money moved               (partially_paid…)
      4. export_status  — whether it reached the accounting SW  (exported…)

    Real example: an invoice can be DELIVERED by the PA (pa: received), still
    UNREVIEWED by the cabinet (review: unreviewed), HALF PAID (payment:
    partially_paid) and FAILED to export to Sage (export: failed) — all true at
    the same instant. One field could never say that.

MIGRATION STRATEGY — normalize on read, never a big-bang script
    Legacy documents only have `state`. `ensure(inv)` fills the four families
    from it lazily, so old rows keep working and no downtime is needed. The
    legacy `state` field is still mirrored on write for one release so a
    rollback stays possible.
"""
from __future__ import annotations

from typing import Any, Dict


class ReviewStatus:
    """What the accounting firm has done with this document."""
    UNREVIEWED = "unreviewed"                    # nobody looked at it yet
    PENDING_VALIDATION = "pending_validation"    # assistant proposed a coding
    CORRECTION_REQUIRED = "correction_required"  # sent back with a comment
    VALIDATED = "validated"                      # senior signed it off


class PaymentStatus:
    """Whether the money actually moved. Derived from allocations later (Z4)."""
    UNPAID = "unpaid"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"
    DISPUTED = "disputed"        # "en litige" — client contests the invoice


class ExportStatus:
    """Whether the entry reached the production accounting software."""
    NOT_READY = "not_ready"      # not validated yet
    READY = "ready"              # validated, waiting for the next batch
    QUEUED = "queued"
    EXPORTED = "exported"
    FAILED = "failed"


#: Legacy single-field values that ALSO imply a payment state.
_LEGACY_PAYMENT_HINTS = {"paid": PaymentStatus.PAID}


def defaults() -> Dict[str, str]:
    """Status block for a brand-new draft invoice."""
    return {
        "pa_status": "draft",
        "review_status": ReviewStatus.UNREVIEWED,
        "payment_status": PaymentStatus.UNPAID,
        "export_status": ExportStatus.NOT_READY,
    }


def ensure(inv: Dict[str, Any]) -> Dict[str, Any]:
    """Fill any missing status family on a (possibly legacy) invoice dict.

    Pure/in-place-safe: returns the same dict for convenient chaining. Never
    overwrites a value that is already present, so a document that has been
    migrated keeps its own truth.
    """
    if inv is None:
        return inv
    legacy = inv.get("state")
    if not inv.get("pa_status"):
        # The legacy field WAS the PA lifecycle state, so it maps 1:1.
        inv["pa_status"] = legacy or "draft"
    if not inv.get("review_status"):
        inv["review_status"] = ReviewStatus.UNREVIEWED
    if not inv.get("payment_status"):
        inv["payment_status"] = _LEGACY_PAYMENT_HINTS.get(legacy, PaymentStatus.UNPAID)
    if not inv.get("export_status"):
        inv["export_status"] = ExportStatus.NOT_READY
    return inv


def review_transition_allowed(current: str, target: str, two_step: bool) -> bool:
    """Guard the review state-machine.

    two_step=False (small cabinets): anyone allowed to review can jump straight
    to `validated`. two_step=True: a proposal must exist before validation, so
    a second pair of eyes is enforced.
    """
    if target == ReviewStatus.PENDING_VALIDATION:
        return current in (ReviewStatus.UNREVIEWED, ReviewStatus.CORRECTION_REQUIRED)
    if target == ReviewStatus.CORRECTION_REQUIRED:
        return current in (ReviewStatus.PENDING_VALIDATION, ReviewStatus.VALIDATED)
    if target == ReviewStatus.VALIDATED:
        if two_step:
            return current == ReviewStatus.PENDING_VALIDATION
        return current in (
            ReviewStatus.UNREVIEWED,
            ReviewStatus.PENDING_VALIDATION,
            ReviewStatus.CORRECTION_REQUIRED,
        )
    if target == ReviewStatus.UNREVIEWED:      # explicit reset
        return True
    return False


def export_status_for_review(review_status: str, current_export: str) -> str:
    """Validated documents become exportable; un-validating pulls them back.

    Already-exported entries are NEVER downgraded — an exported line lives in
    the client's accounting software and must be corrected by a new entry, not
    by rewriting history.
    """
    if current_export in (ExportStatus.EXPORTED, ExportStatus.QUEUED):
        return current_export
    if review_status == ReviewStatus.VALIDATED:
        return ExportStatus.READY
    return ExportStatus.NOT_READY
