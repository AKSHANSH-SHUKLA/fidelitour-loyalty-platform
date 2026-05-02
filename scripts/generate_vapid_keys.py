"""
One-shot VAPID key generator for FidéliTour Web Push.

Run once locally:
    pip install py-vapid cryptography
    python scripts/generate_vapid_keys.py

Then copy the printed values into Vercel environment variables:
    VAPID_PRIVATE_KEY   ← the multi-line PEM block
    VAPID_PUBLIC_KEY    ← the URL-safe base64 line
    VAPID_SUBJECT       ← mailto:contact@your-business.fr  (or your email)

Re-deploy after setting env vars. Browsers will then pick up the public key
from /api/public/vapid-public-key when subscribing.

These keys are PERMANENT for your install — rotating them will invalidate
every existing customer subscription, so generate once and store safely.
"""
from __future__ import annotations
import sys


def main() -> int:
    try:
        from py_vapid import Vapid                       # noqa: WPS433
    except ImportError:
        print("ERROR: py_vapid not installed. Run:  pip install py-vapid cryptography",
              file=sys.stderr)
        return 1

    v = Vapid()
    v.generate_keys()

    # py_vapid <2 vs ≥2 expose slightly different APIs — handle both.
    if hasattr(v, "private_pem"):
        priv_pem = v.private_pem().decode("utf-8")
    else:
        from cryptography.hazmat.primitives import serialization
        priv_pem = v.private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("utf-8")

    if hasattr(v, "public_key_b64"):
        pub_b64 = v.public_key_b64().decode("utf-8") if isinstance(
            v.public_key_b64(), bytes) else v.public_key_b64()
    else:
        # Fallback: serialize raw point and base64url-encode.
        from cryptography.hazmat.primitives import serialization
        import base64
        raw = v.public_key.public_bytes(
            encoding=serialization.Encoding.X962,
            format=serialization.PublicFormat.UncompressedPoint,
        )
        pub_b64 = base64.urlsafe_b64encode(raw).rstrip(b"=").decode("utf-8")

    print("=" * 70)
    print("VAPID_PRIVATE_KEY (paste as a multi-line Vercel env var):")
    print("-" * 70)
    print(priv_pem.strip())
    print()
    print("=" * 70)
    print("VAPID_PUBLIC_KEY (single line):")
    print("-" * 70)
    print(pub_b64)
    print()
    print("=" * 70)
    print("VAPID_SUBJECT  (set this to your business email, prefixed with mailto:)")
    print("-" * 70)
    print("mailto:contact@your-business.fr")
    print()
    print("Next steps:")
    print("  1. Vercel → Project Settings → Environment Variables")
    print("  2. Add the three vars above (Production + Preview)")
    print("  3. Redeploy")
    print("  4. Visit /card/<your-test-barcode> on a phone, toggle notifications,")
    print("     accept the permission prompt — done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
