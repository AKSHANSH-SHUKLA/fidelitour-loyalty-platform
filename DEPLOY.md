# FidéliTour deployment runbook

One-page checklist for deploying the platform to Vercel + MongoDB Atlas.
Read top-to-bottom; skip nothing. The whole flow takes ~30 minutes.

## 1. Generate environment variables (3 minutes)

```bash
cd fidelitour-deploy
npm install                    # only needed once
npm run setup-env              # prints env block to stdout
# OR
npm run setup-env:write        # writes to .env.local for local dev
```

Copy the output. It contains:

- A fresh **VAPID keypair** for Web Push (generated locally — never sent to anyone).
- Strong random secrets for **JWT_SECRET**, **CRON_SECRET**, **COOKIE_SECRET**.
- Stub placeholders for everything else (Mongo, Stripe, Twilio, LLM, etc.).

> **IMPORTANT:** Generate VAPID keys ONCE per environment and never rotate them
> casually. Every existing browser push subscription becomes invalid the
> moment the public key changes.

## 2. Set up MongoDB Atlas (5 minutes)

1. Sign up at https://cloud.mongodb.com.
2. Create a free M0 cluster in the closest EU region (Frankfurt for France).
3. **Database Access** → add a user with read/write to the `fidelitour` DB.
4. **Network Access** → add `0.0.0.0/0` (Vercel's IPs are dynamic; this is the
   safe pattern. The DB still requires the username+password to connect.)
5. **Connect** → Drivers → copy the `mongodb+srv://...` URI.
6. Paste into the `MONGODB_URI` slot in the env block from step 1.

## 3. Get LLM keys (2 minutes — pick at least one)

Free tiers, all are fine. Easiest first:

| Provider | Sign-up | Free tier |
|---|---|---|
| Groq | https://console.groq.com/keys | Yes — fastest, ample quota |
| OpenRouter | https://openrouter.ai/keys | Yes — one key, many models |
| Gemini | https://aistudio.google.com/apikey | Yes — Google's |

Paste at least one into the env block. The platform tries them in the order
above and falls through. If none are set, AI features render a "configure a
provider" empty state — they don't crash.

## 4. Get a Twilio account (10 minutes — optional, only for SMS)

Skip this section if your client only wants push notifications.

1. https://www.twilio.com → sign up.
2. Console → buy a French long-code number (~€1/month).
3. **Important for France:** complete the [A2P 10DLC equivalent](https://www.twilio.com/docs/messaging/compliance/sms-france-pid) registration.
   Without this, French carriers will silently drop your messages.
4. Copy `Account SID`, `Auth Token`, `From Number` into the env block.

Without these, SMS sends are no-op'd silently — push still works.

## 5. Set up Stripe (10 minutes — required for subscription billing)

1. https://dashboard.stripe.com → sign up the **reseller's** business.
2. **Products** → create three subscription products:
   - Starter — €19.90/month — recurring
   - Growth — €39.90/month — recurring
   - Pro — €79.90/month — recurring
3. Copy the `price_xxx` ID for each into `STRIPE_PRICE_*` slots.
4. **Developers → API keys** → copy `sk_live_...` (or `sk_test_...` while testing).
5. **Developers → Webhooks** → Add endpoint:
   - URL: `https://YOUR_DOMAIN/api/billing/webhook`
   - Events: `checkout.session.completed`, `invoice.paid`,
     `invoice.payment_failed`, `customer.subscription.updated`,
     `customer.subscription.deleted`
   - Copy the signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.

## 6. Push everything to Vercel (5 minutes)

1. Connect this repo to Vercel (https://vercel.com/new).
2. **Settings → Environment Variables** → paste the entire env block from
   step 1, applied to **Production AND Preview AND Development**.
3. Trigger a deploy.
4. Visit `https://YOUR_DOMAIN/admin` → log in as super-admin → check
   **Settings → Environment status**. Every required key should be green.

## 7. Verify the cron jobs (2 minutes)

`vercel.json` already has the schedule:

```json
"crons": [
  { "path": "/api/cron/daily-triggers", "schedule": "0 8 * * *" },
  { "path": "/api/cron/monthly-report", "schedule": "0 9 1 * *" }
]
```

Vercel auto-passes `Authorization: Bearer $CRON_SECRET` to cron-triggered
calls. No additional config needed.

To trigger manually for testing:

```bash
curl -X POST https://YOUR_DOMAIN/api/cron/daily-triggers \
  -H "Authorization: Bearer $CRON_SECRET"
```

The response is JSON: `{ "status": "ok", "birthday_prepared": N, ... }`.

## 8. Smoke test (5 minutes)

Open the platform end-to-end as a real user would:

1. **Owner signup** → /signup → fills business form → reaches dashboard.
2. **Customer join** → /join/<slug> → fills form → gets wallet card.
3. **PWA install** → on mobile, tap "Add to home screen" prompt → opens
   standalone.
4. **Push toggle** → on installed PWA, toggle Notifications on → first push
   from owner dashboard arrives.
5. **Geo consent** → tap "Activate location" → grant → proximity ping logged.
6. **QR scan** → owner POS → scan customer's QR → visit recorded.
7. **Stripe checkout** → super-admin creates a tenant subscription → tenant
   sees billing portal in Settings.

If any of these fail, check `/api/admin/env-status` first. 95% of "broken"
deployments are a missing env var.

## Common pitfalls

- **"Push toggle does nothing on iPhone"** → user hasn't installed the PWA.
  iOS only allows web push from a home-screen-installed standalone PWA.
  This is an Apple constraint, not a bug. The wallet page surfaces an
  install prompt automatically.
- **"AI tabs say no provider configured"** → set `GROQ_API_KEY` (free, fastest
  to get).
- **"Cron isn't running"** → Vercel Cron is paid-plan only. Free-tier projects
  need an external scheduler (cron-job.org works) hitting the same URL with
  the secret.
- **"Camera doesn't open on Firefox"** → user must grant camera permission;
  the scanner falls back to file upload otherwise.
