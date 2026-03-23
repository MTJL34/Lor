# Backend API (LoR PoC)

Backend Node.js/Express + MySQL pour ton projet LoR.

## Prerequisites

- Node.js 18+
- MySQL 8+
- DB accessible avec les variables d'environnement

## Configuration

1. Copier `.env.example` vers `.env` (dans `poc/` ou à la racine parent).
2. Renseigner les credentials MySQL.
3. Ajouter `JWT_SECRET`.
4. (Conformite) Configurer si besoin:
   - `TERMS_VERSION` (defaut: `2026-03`)
   - `PRIVACY_POLICY_VERSION` (defaut: `2026-03`)
   - `DATA_RETENTION_DAYS` (defaut: `365`)

## Database setup

- `npm run db:seed` : importe les tables/data de `frontEnd/data/all_data_mysql.sql`.
- `npm run db:init` : cree/migre les tables backend (`users`, `user_region_inventory`, `user_app_state`, `user_audit_log`).
- `npm run db:setup` : seed + init.
- Conversion MySQL -> PostgreSQL (Supabase):
  - `npm run db:convert:pg -- --input backEnd/sql/core_tables.sql --output backEnd/sql/core_tables.postgres.sql`
  - Ajouter `--with-data` si tu veux conserver les `INSERT`.

## Run

- Dev: `npm run dev`
- Prod: `npm start`

API base URL: `http://localhost:3000/api`

## Main endpoints

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (Bearer)
- `PATCH /api/auth/consent` (Bearer)
- `GET /api/meta/regions|costs|stars|levels|constellations`
- `GET /api/champions?poc=true&regionId=5&search=ahri`
- `GET /api/champions/:championId`
- `POST /api/champions` (Bearer)
- `PUT /api/champions/:championId` (Bearer)
- `DELETE /api/champions/:championId` (Bearer)
- `PUT /api/champions/:championId/relics` (Bearer)
- `GET /api/relics?rarity=Epic`
- `GET /api/site-data`
- `PUT /api/site-data` (Bearer)
- `GET /api/inventory` (Bearer)
- `PUT /api/inventory/region/:regionId` (Bearer)
- `POST /api/inventory/region/:regionId/craft` (Bearer)
- `POST /api/inventory/import` (Bearer)
- `GET /api/inventory/export` (Bearer)

## Notes

- Si `health` renvoie des tables manquantes, execute `npm run db:setup`.
- Le craft suit la regle: `100 nova_shards = 1 nova_crystal`.
- L'inventaire est par utilisateur.
- `ALLOW_GUEST_AUTH=true` permet au front de se connecter sans login (utilisateur `guest@lor.local` auto-cree).
- `POST /api/auth/register` exige des consentements explicites:
  - `termsAccepted: true`
  - `privacyAccepted: true`
  - `marketingConsent: boolean` (optionnel)
- Les evenements sensibles auth/consentement sont traces dans `user_audit_log`.
