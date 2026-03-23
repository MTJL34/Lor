# Backend API (LoR PoC)

Backend Node.js/Express avec persistance JSON.

## Prerequisites

- Node.js 18+
- Pas de MySQL requis

## Configuration

1. Copier `.env.example` vers `.env` (dans `poc/` ou a la racine parent).
2. Ajouter `JWT_SECRET`.
3. (Conformite) Configurer si besoin:
   - `TERMS_VERSION` (defaut: `2026-03`)
   - `PRIVACY_POLICY_VERSION` (defaut: `2026-03`)
   - `DATA_RETENTION_DAYS` (defaut: `365`)

## JSON database

- Fichier principal: `backEnd/data/database.json`
- `npm run db:init` : cree le fichier JSON s'il n'existe pas.
- `npm run db:seed` : resynchronise les donnees catalogue depuis `frontEnd/data/*` en conservant les donnees runtime utilisateur.
- `npm run db:setup` : seed + init.
- `JSON_DB_PATH` permet de deplacer le fichier JSON vers un disque persistant (utile sur Render).

Le backend genere automatiquement `backEnd/data/database.json` au demarrage si le fichier est absent.

## Render

Pour Render, utilise un disque persistant et pointe le backend dessus:

- Monter le disque sur `/var/data`
- Definir `JSON_DB_PATH=/var/data/database.json`
- Utiliser un `Web Service` Node
- Health check: `/api/health`

Le fichier [render.yaml](/Users/mtjl/Documents/Lor/render.yaml) configure deja ce cas.

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

- Si `health` renvoie un etat degrade, execute `npm run db:setup`.
- Le craft suit la regle: `100 nova_shards = 1 nova_crystal`.
- L'inventaire est par utilisateur.
- `ALLOW_GUEST_AUTH=true` permet au front de se connecter sans login (utilisateur `guest@lor.local` auto-cree).
- `POST /api/auth/register` exige des consentements explicites:
  - `termsAccepted: true`
  - `privacyAccepted: true`
  - `marketingConsent: boolean` (optionnel)
- Les evenements sensibles auth/consentement sont traces dans `userAuditLog` du fichier JSON.
