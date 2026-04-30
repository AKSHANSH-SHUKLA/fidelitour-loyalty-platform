"""
Single wire-up for all feature modules.

Usage — add these two lines at the very bottom of `server.py`:

    from features._loader import register_all
    register_all(app, db)

Comment any module in MODULES below to disable it cleanly.
Nothing else in the codebase changes.
"""

import importlib
import logging

logger = logging.getLogger("fidelitour.features")

# Order doesn't matter functionally; grouped by domain for readability.
MODULES = [
    # Loyalty rules / config
    "features.welcome_bonus",
    "features.referrals",
    "features.happy_hour",
    "features.reviews",
    "features.registration_forms",
    # AI / predictive — fully implemented (math-based)
    "features.ai_send_time",
    "features.ai_churn",
    # AI / predictive — stubs with spec
    "features.ai_anomaly",
    "features.ai_voice_campaign",
    "features.ai_birthday",
    "features.ai_translate",
    "features.ai_brand_voice",
    "features.ai_conversational",
    "features.ai_staffing",
    "features.ai_competitive",
    "features.ai_newsletter",
    "features.tier_optimizer",
]


def register_all(app, db) -> None:
    """Import each feature module, run its optional init(db), and mount its router.

    Failures are logged but never raised — a broken feature module must not
    take down the whole server.
    """
    for dotted_path in MODULES:
        try:
            module = importlib.import_module(dotted_path)
            if hasattr(module, "init"):
                module.init(db)
            if hasattr(module, "router"):
                app.include_router(module.router)
                logger.info("feature loaded: %s", dotted_path)
            else:
                logger.warning("feature %s has no router; skipping", dotted_path)
        except Exception as exc:  # noqa: BLE001
            logger.exception("feature %s failed to load: %s", dotted_path, exc)
