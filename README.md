# FuelSync

FuelSync is the first foundation version of a nutrition planning app.

V1 included:

- React + Vite + TypeScript frontend
- Tailwind CSS app shell
- Auth0 authentication
- Netlify Functions backend API
- Neon PostgreSQL database
- Ingredient CRUD
- Recipe CRUD
- Recipe ingredient rows
- Automatic macro totals

V2 adds:

- Weekly training planner
- Activity scheduling
- Day priority engine
- Timing context engine
- Meal recommendation scoring
- Daily meal selection
- Macro target settings
- Goal-specific macro targets
- Dashboard V2

Still not included:

- Long-range meal planner automation
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
|   |   |-- 001_initial_schema.sql
|   |   `-- 002_planner_foundation.sql
|   `-- seed.sql
|-- netlify/
|   `-- functions/
|       |-- _shared/
|       |   |-- auth.ts
|       |   |-- db.ts
|       |   |-- http.ts
|       |   |-- netlify-types.ts
|       |   `-- validation.ts
|       |-- activities.ts
|       |-- ingredients.ts
|       |-- macro-targets.ts
|       |-- meal-selections.ts
|       |-- recipes.ts
|       `-- stats.ts
|-- scripts/
|   |-- seed-examples.mjs
|   `-- seed-macro-targets.mjs
|-- src/
|   |-- components/
|   |-- hooks/
|   |-- lib/
|   |-- pages/
|   |-- services/
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

The V1 and V2 schemas have already been applied to Neon.

Created tables:

```text
ingredients
recipes
recipe_ingredients
activities
daily_meal_selections
macro_targets
```

Migration files:

```text
database/migrations/001_initial_schema.sql
database/migrations/002_planner_foundation.sql
```

Seed data has already been inserted for:

```text
auth0|69fcebc830f4b48abbba5fb8
```

Current seeded data:

```text
10 ingredients
3 recipes
20 macro target profiles
```

Reusable seed script:

```bash
DATABASE_URL="postgresql://..." SEED_USER_ID="auth0|..." node scripts/seed-examples.mjs
DATABASE_URL="postgresql://..." SEED_USER_ID="auth0|..." node scripts/seed-macro-targets.mjs
```

On Windows PowerShell:

```powershell
$env:DATABASE_URL="postgresql://..."
$env:SEED_USER_ID="auth0|..."
node scripts/seed-examples.mjs
node scripts/seed-macro-targets.mjs
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
- `GET/POST/PUT/DELETE /api/activities`
- `GET/PUT /api/meal-selections`
- `GET/PUT /api/macro-targets`
- `GET/PUT /api/user-preferences`

Each Netlify Function:

- validates the Auth0 JWT
- extracts `sub`
- uses `sub` as `user_id`
- only reads or modifies data for that user
- never trusts `user_id` from the frontend

## V2 App Routes

```text
/              Dashboard V2
/planner       Weekly activity planner
/today         Daily meal suggestions and selections
/ingredients  Ingredient CRUD
/recipes      Recipe CRUD
/settings     Account and macro targets
```

Macro targets are stored per target goal and day type:

```text
recomp
fat_loss
maintenance
cut
lean_bulk
```

The active target goal is stored in `user_preferences` and is used by the dashboard and daily suggestions.

## Recommendation Logic

Pure service modules live in:

```text
src/services/dayPriority.ts
src/services/timingEngine.ts
src/services/recommendations.ts
```

Day type rules:

- `interval_bike` overrides everything
- `endurance_bike` overrides `gym` when duration is at least 120 minutes
- `gym` overrides `rest`
- `rest` is used when no activity exists

Timing rules:

- Morning training: breakfast pre-workout, lunch post-workout
- Afternoon training: lunch pre-workout, dinner post-workout
- Evening training: lunch carb support, snack pre-workout, dinner post-workout
- No training: all meals neutral

The recommendation engine scores recipe candidates by:

- meal type
- day type fit
- timing fit
- macro fit
- carb suitability
- fat suitability

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
