# External-service wrappers (SMS, email, push). Each module is a thin
# integration that no-ops gracefully if its env vars aren't set, so the
# rest of the app never breaks because a third-party isn't configured.
