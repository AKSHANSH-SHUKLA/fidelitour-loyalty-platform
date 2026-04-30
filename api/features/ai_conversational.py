"""
Conversational Analytics — additive AI feature module.

Status: 🟡 Stub with spec. Returns mock answers; needs LLM + tool-use to ship.
Mounts at: /api/owner/ai/ask
Collections: reads everything (read-only).

Production implementation (estimated 16 hours):
- Use Anthropic Claude or OpenAI GPT-4 with tool/function calling.
- Define tools the model can call: get_visits, get_customers, get_revenue,
  get_campaigns, get_churn, etc. Each tool has clear input/output schemas.
- Model orchestrates multiple tool calls to answer "Why did Saturday traffic drop?"
- Stream the answer back to the frontend with citations to specific data.
- Cost per question: ~€0.01–0.05 depending on how many tool round-trips.
- Rate-limit per tenant (use existing PLAN_FEATURES.ai_queries_per_day).
"""
from __future__ import annotations
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from auth import require_role

router = APIRouter(tags=["ai-conversational"])
_db = None


def init(db):
    global _db
    _db = db


class AskRequest(BaseModel):
    question: str


@router.post("/api/owner/ai/ask")
def ask(
    req: AskRequest,
    token_data=Depends(require_role(["business_owner", "manager"])),
):
    # TODO: replace with Claude tool-use orchestration.
    # The real implementation runs tool calls against existing endpoints
    # (or direct DB queries via read-only helper functions) and streams
    # a narrative answer with source citations.
    return {
        "stub": True,
        "question": req.question,
        "answer": (
            "[Stub] When live, this will investigate visits, weather, and campaigns "
            "in your data and explain the drop or spike with cited evidence. "
            "Ask anything: 'Why did Saturday traffic drop?', 'Who are my best customers?'"
        ),
        "sources": [],
    }
