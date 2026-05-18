# FuelSync

FuelSync is the first foundation version of a nutrition planning app.

This phase includes:

- React + Vite + TypeScript frontend
- Tailwind CSS app shell
- Auth0 authentication
- Netlify Functions backend API
- Neon PostgreSQL database
- Ingredient CRUD
- Recipe CRUD
- Recipe ingredient rows
- Automatic macro totals

Not included yet:

- Planner
- Meal recommendations
- AI

## Live Project

GitHub:

```text
https://github.com/Joey9220/FuelSync.git
```

Netlify:

```text
https://fuelsync01.netlify.app
```

Current Auth0 tenant:

```text
dev-3x6nxzjmzbjy70fy.eu.auth0.com
```

Current Auth0 SPA client ID:

```text
pNTZ21UuCu8B4a9hX3fL4cxBdFRpivE3
```

Current Auth0 API audience:

```text
https://fuelsync-api
```

Seeded Auth0 user id:

```text
auth0|69fcebc830f4b48abbba5fb8
```

## Architecture Rule

The React frontend must never connect directly to Neon.

All database operations go through Netlify Functions. `DATABASE_URL` must only exist server-side in Netlify environment variables or local server-side tooling.

## File Structure

```text
.
|-- database/
|   |-- migrations/
|   |   `-- 001_initial_schema.sql
|   `-- seed.sql
|-- netlify/
|   `-- functions/
|       |-- _shared/
|       |   |-- auth.ts
|       |   |-- db.ts
|       |   |-- http.ts
|       |   |-- netlify-types.ts
|       |   `-- validation.ts
|       |-- ingredients.ts
|       |-- recipes.ts
|       `-- stats.ts
|-- scripts/
|   `-- seed-examples.mjs
|-- src/
|   |-- components/
|   |-- hooks/
|   |-- lib/
|   |-- pages/
|   |-- App.tsx
|   |-- main.tsx
|   |-- styles.css
|   |-- types.ts
|   `-- vite-env.d.ts
|-- .env.example
|-- netlify.toml
|-- package.json
|-- tailwind.config.ts
`-- vite.config.ts
```

## Netlify Environment Variables

Paste these into Netlify under:

```text
Site configuration -> Environment variables -> Import from .env
```

```env
VITE_AUTH0_DOMAIN=dev-3x6nxzjmzbjy70fy.eu.auth0.com
VITE_AUTH0_CLIENT_ID=pNTZ21UuCu8B4a9hX3fL4cxBdFRpivE3
VITE_AUTH0_AUDIENCE=https://fuelsync-api
VITE_API_BASE_URL=/api
AUTH0_DOMAIN=dev-3x6nxzjmzbjy70fy.eu.auth0.com
AUTH0_AUDIENCE=https://fuelsync-api
DATABASE_URL=your-neon-postgresql-connection-string
```

After changing any `VITE_` variable in Netlify, trigger:

```text
Clear cache and deploy site
```

Vite embeds `VITE_` values at build time.

## Auth0 Setup

Auth0 application type:

```text
Single Page Application
```

Allowed Callback URLs:

```text
https://fuelsync01.netlify.app, http://localhost:8888, http://127.0.0.1:5173
```

Allowed Logout URLs:

```text
https://fuelsync01.netlify.app, http://localhost:8888, http://127.0.0.1:5173
```

Allowed Web Origins:

```text
https://fuelsync01.netlify.app, http://localhost:8888, http://127.0.0.1:5173
```

Auth0 API:

```text
Name: FuelSync API
Identifier: https://fuelsync-api
Signing Algorithm: RS256
```

The backend validates the Auth0 JWT in every Netlify Function and uses the token `sub` claim as `user_id`.

## Neon Setup

The initial schema has already been applied to Neon.

Created tables:

```text
ingredients
recipes
recipe_ingredients
```

Migration file:

```text
database/migrations/001_initial_schema.sql
```

Seed data has already been inserted for:

```text
auth0|69fcebc830f4b48abbba5fb8
```

Current seeded data:

```text
10 ingredients
3 recipes
```

Reusable seed script:

```bash
DATABASE_URL="postgresql://..." SEED_USER_ID="auth0|..." node scripts/seed-examples.mjs
```

On Windows PowerShell:

```powershell
$env:DATABASE_URL="postgresql://..."
$env:SEED_USER_ID="auth0|..."
node scripts/seed-examples.mjs
```

## Local Development

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example`.

For frontend-only development:

```bash
npm run dev
```

For full local API testing with Netlify Functions, use Netlify Dev:

```bash
netlify dev
```

Build:

```bash
npm run build
```

## Netlify Deployment

Netlify is connected to GitHub:

```text
Joey9220/FuelSync
```

Build settings:

```text
Build command: npm run build
Publish directory: dist
Functions directory: netlify/functions
```

`netlify.toml` also redirects:

```text
/api/* -> /.netlify/functions/:splat
```

## API Boundary

The frontend calls:

- `GET/POST/PUT/DELETE /api/ingredients`
- `GET/POST/PUT/DELETE /api/recipes`
- `GET /api/stats`

Each Netlify Function:

- validates the Auth0 JWT
- extracts `sub`
- uses `sub` as `user_id`
- only reads or modifies data for that user
- never trusts `user_id` from the frontend

## Git Workflow

Updates are not pushed to GitHub automatically just because files change locally.

The normal flow is:

```bash
git status
git add .
git commit -m "Describe the change"
git push
```

If you ask me to change code or docs, I can also commit and push the update for you in the same turn.
