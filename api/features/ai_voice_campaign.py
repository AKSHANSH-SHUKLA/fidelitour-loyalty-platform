"""
Voice-to-Campaign — additive AI feature module.

Status: 🟡 Stub with spec. Returns mock; needs LLM + STT to ship.
Mounts at: /api/owner/ai/voice-campaign
Collections: writes to existing `campaigns` (only via standard create endpoint).

Production implementation (estimated 12 hours):
- Frontend uploads a short audio clip (mp3/wav/webm, max 60s).
- Backend pipes it to a speech-to-text model (OpenAI Whisper, Google STT,
  or Anthropic via base64). Cost: ~€0.006 per minute.
- The transcript becomes the prompt for an LLM call that produces:
    {name, content, suggested_filters, suggested_send_time}
- Store as a draft campaign (status='draft'); merchant approves via the
  existing CampaignsPage UI. No new write to existing campaigns endpoint.
- Cost per call (typical 30s voice memo): ~€0.01 STT + ~€0.005 LLM = ~€0.015.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, UploadFile, File
from auth import require_role

router = APIRouter(tags=["ai-voice-campaign"])
_db = None


def init(db):
    global _db
    _db = db


@router.post("/api/owner/ai/voice-campaign")
async def transcribe_and_draft(
    audio: UploadFile = File(...),
    token_data=Depends(require_role(["business_owner", "manager"])),
):
    # TODO: 1) call Whisper-style STT on `audio.file`
    #       2) feed transcript to LLM with brand-voice profile
    #       3) return structured draft below
    return {
        "stub": True,
        "transcript": "Send something to my regulars about our new pumpkin spice latte this weekend.",
        "draft": {
            "name": "Pumpkin Spice — Weekend Push",
            "content": "Sophie, autumn arrived in cup form ☕ — try our new pumpkin spice latte this weekend.",
            "suggested_filters": {"tier": "gold", "min_visits": 5},
            "suggested_send_time_utc": "2026-04-30T08:00:00Z",
        },
        "needs_review_before_send": True,
    }
