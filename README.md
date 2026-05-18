# FuelSync

FuelSync is the first foundation version of a nutrition planning app. This phase includes Auth0 login, a React app shell, ingredient CRUD, recipe CRUD, recipe ingredient rows, macro totals, Neon PostgreSQL schema, and Netlify Functions as the only database access layer.

The planner, recommendations, and AI features are intentionally not included.

## File Structure

```text
.
├─ database/
│  ├─ migrations/
│  │  └─ 001_initial_schema.sql
│  └─ seed.sql
├─ netlify/
│  └─ functions/
│     ├─ _shared/
│     │  ├─ auth.ts
│     │  ├─ db.ts
│     │  ├─ http.ts
│     │  ├─ netlify-types.ts
│     │  └─ validation.ts
│     ├─ ingredients.ts
│     ├─ recipes.ts
│     └─ stats.ts
├─ src/
│  ├─ components/
│  ├─ hooks/
│  ├─ lib/
│  ├─ pages/
│  ├─ App.tsx
│  ├─ main.tsx
│  ├─ styles.css
│  ├─ types.ts
│  └─ vite-env.d.ts
├─ .env.example
├─ netlify.toml
├─ package.json
├─ tailwind.config.ts
└─ vite.config.ts
```

## Environment Variables

Frontend `.env`:

```bash
VITE_AUTH0_DOMAIN=your-tenant.eu.auth0.com
VITE_AUTH0_CLIENT_ID=your-auth0-spa-client-id
VITE_AUTH0_AUDIENCE=https://fuelsync-api
VITE_API_BASE_URL=/api
```

Netlify server-side environment:

```bash
DATABASE_URL=postgresql://...
AUTH0_DOMAIN=your-tenant.eu.auth0.com
AUTH0_AUDIENCE=https://fuelsync-api
```

`DATABASE_URL` must only be configured in Netlify or local server-side dev tooling. Do not expose it with a `VITE_` prefix.

## Auth0 Setup

1. Create an Auth0 Single Page Application.
2. Add allowed callback URLs:
   - `http://localhost:8888`
   - your Netlify production URL
3. Add allowed logout URLs with the same values.
4. Add allowed web origins with the same values.
5. Create an API in Auth0 and use its identifier as `VITE_AUTH0_AUDIENCE` and `AUTH0_AUDIENCE`.
6. Use the Auth0 domain and SPA client ID in the frontend environment variables.

The backend validates the Auth0 JWT in every Netlify Function and uses `sub` as the user-owned `user_id`.

## Neon Setup

1. Create a Neon project and database.
2. Copy the pooled or direct PostgreSQL connection string into Netlify as `DATABASE_URL`.
3. Run the migration:

```bash
psql "$DATABASE_URL" -f database/migrations/001_initial_schema.sql
```

4. Optional seed data:

Edit `database/seed.sql` and replace `auth0|replace-me` with your Auth0 user ID, then run:

```bash
psql "$DATABASE_URL" -f database/seed.sql
```

## Local Development

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example`.

For full local API testing with Netlify Functions, install/use Netlify CLI and run:

```bash
netlify dev
```

For frontend-only development:

```bash
npm run dev
```

Build:

```bash
npm run build
```

## API Boundary

The React frontend never connects to Neon. It calls:

- `GET/POST/PUT/DELETE /api/ingredients`
- `GET/POST/PUT/DELETE /api/recipes`
- `GET /api/stats`

Netlify redirects `/api/*` to `/.netlify/functions/*`. Each function validates the JWT, extracts `sub`, and scopes every query by `user_id`.
