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
    # Owner workflow & visibility
    "features.history",                 # past campaigns + push notifications
    "features.analytics_history",       # extended weekly/daily/monthly history
    "features.customer_status",         # configurable active/inactive definition
    "features.tier_definitions",        # custom tier thresholds + big-spender rule
    "features.auto_campaigns",          # auto birthday + inactive rescue messages
    "features.push_subscriptions",      # web push subscriptions + dispatch helper
    # AI / predictive — fully implemented (math-based)
    "features.ai_send_time",
    "features.ai_churn",
    # AI / predictive — stubs with spec
    "features.ai_anomaly",
    # "features.ai_voice_campaign",   # ⚠ disabled — code preserved, route unmounted
    "features.ai_birthday",
    "features.ai_translate",
    "features.ai_brand_voice",
    "features.ai_conversational",
    # "features.ai_staffing",         # ⚠ disabled — code preserved, route unmounted
    # "features.ai_competitive",      # ⚠ disabled — code preserved, route unmounted
    "features.ai_newsletter",
    "features.tier_optimizer",
    # NOTE on A/B testing: there's no dedicated module for auto-A/B testing.
    # It was a planned/described feature in the docs but never had its own
    # backend module mounted. So there's nothing to disable here.
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
