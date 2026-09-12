# FidClic — Plateforme (dashboards + API)

SaaS de fidélité pour commerces français : carte Apple/Google Wallet, tampons + points,
campagnes push, analytics, assistant IA — et conformité **facturation électronique 2026**
(intégration B2Brouter / PDP, Factur-X, e-reporting).

> Le site marketing (fidclic.com) vit dans un AUTRE repo. Ici = la plateforme :
> tout ce qui existe derrière le login.

## Architecture (1 minute)

```
src/            React 18 + Vite + Tailwind — dashboards owner / admin / staff + PWA client
api/server.py   FastAPI — TOUT le backend (auth JWT, rôles, cartes, campagnes, facturation)
api/models.py   Modèles Pydantic (CardTemplate, Tenant, Customer…)
api/services/   pdp_connector.py = intégration B2Brouter (e-invoicing)
api/features/   facturation.py = routes facturation + webhook
vercel.json     Déploiement : frontend statique + api/ en serverless — MÊME origine, pas de CORS
```

- **Base de données : MongoDB** (`MONGO_URL`). Pas de PostgreSQL.
- **Rôles** : `super_admin` (tous tenants), `business_owner` (son commerce), `staff` (scan visites).
  Login → `POST /api/auth/login` → `access_token` (JWT). Comptes démo seedés au premier boot.
- **Carte client** : `src/components/WalletPassPreview.jsx` = rendu fidèle pkpass
  (theme dérivé par `src/lib/cardTheme.js` — 2 couleurs choisies, le reste calculé WCAG).
- **Designer** : `src/pages/CardDesignerPage.jsx`. Payload client : `GET /api/card/{barcode_id}`.

## Lancer en local

```bash
npm install && npm run dev            # frontend (proxy /api → :8000)
pip install -r api/requirements.txt
uvicorn api.server:app --port 8000    # backend (MONGO_URL requis, sinon voir tests mongomock)
```

## Variables d'environnement

Voir `.env.example`. En prod (Vercel) : Settings → Environment Variables → redeploy obligatoire.

## Avant mise en production réelle

- [ ] Désactiver le seed démo (comptes demo.* / Café Lumière) derrière un flag env
- [ ] Corriger la stratégie de cache du service worker (network-first sur le HTML)
- [ ] Nouveau `JWT_SECRET` + cluster Mongo de production
- [ ] Clé B2Brouter de production (plan payant) — la clé test ne facture pas réellement

## Contexte complet

`CLAUDE.md` = handoff détaillé (décisions, conventions, historique). À lire avant toute
modification importante. `DEPLOY.md`, `PLAN.md` = docs historiques.
