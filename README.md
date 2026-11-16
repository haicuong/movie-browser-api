# Movie Browser API

Movie Browser API is an Express and TypeScript REST API for user authentication and managing per-user favorite movies. User accounts and favorites are stored persistently in PostgreSQL (Neon in production) via Prisma ORM, movie metadata is fetched from TMDb and cached in PostgreSQL, and sessions use JWTs stored in `HttpOnly` cookies.

## Technology stack

- **Runtime & Language:** Node.js with TypeScript (`^5.9.3`), ESM (`"type": "module"`)
- **HTTP & Security:** Express `^5.3.0`, custom OWASP security headers (`src/middleware/security-headers.ts`), `cors`, `cookie-parser`, `express-rate-limit`
- **Database & ORM:** PostgreSQL (Neon) + Prisma ORM `^7.10.1` (`@prisma/adapter-pg`, `pg`), `@vercel/functions` (`attachDatabasePool`)
- **Auth & Validation:** `argon2` (Argon2id), `jsonwebtoken`, `zod` `^4.6.7`
- **Testing & Tooling:** Vitest `^5.1.0`, Supertest, `tsx`, `dotenv`, `dotenv-cli`

## Features

- `GET /health` service health check
- **Cookie-based JWT authentication** (`email` + `password`, Argon2id password hashing, `HttpOnly` `token` cookie):
  - `POST /register` — Create account, hash password with Argon2id, and immediately set auth cookie
  - `POST /login` — Verify credentials and set auth cookie
  - `POST /logout` — Clear auth cookie
  - `GET /me` — Return currently authenticated user info (`id`, `email`, `createdAt`)
- **User-scoped Favorites CRUD** (all protected by `requireAuth`):
  - `GET /favorites` — List user favorites with pagination (`?page=`, `?limit=`, defaults `1` and `20`, ordered by `createdAt` descending)
  - `GET /favorites/:tmdbId` — Retrieve one favorite movie for the authenticated user
  - `POST /favorites/:tmdbId` — Add a movie by TMDb ID (uses cached `movies` row if present; otherwise fetches from TMDb and caches it)
  - `DELETE /favorites/:tmdbId` — Remove a movie from the authenticated user's favorites
- **CORS & Cookie policy:** Configurable origin allowlist (`CORS_ORIGIN`) with `credentials: true` and environment-aware cookie flags (`SameSite=Lax` + `Secure` in production HTTPS; `SameSite=Lax` + `Secure=false` on local HTTP; optional `COOKIE_SAME_SITE=none` for cross-site preview environments)
- **Rate limiting:** Global `100` req / `15` min per IP (`appLimiter`) and stricter `15` req / `15` min per IP on `/register` and `/login` (`authLimiter`)
- **Centralized JSON error handling** and request completion logging

## Project structure

```text
.
├── src/
│   ├── config/
│   │   ├── cookies.ts                 Cookie name and environment-aware cookie options
│   │   └── env.ts                     Zod environment validation (runtime + server)
│   ├── controllers/
│   │   ├── auth.controller.ts         register, login, logout, getMe handlers
│   │   ├── create-favorite.controller.ts
│   │   ├── delete-favorite.controller.ts
│   │   ├── get-favorite.controller.ts
│   │   └── list-favorites.controller.ts
│   ├── errors/
│   │   └── errors.ts                  Application error classes (400, 401, 403, 404, 409, 502)
│   ├── middleware/
│   │   ├── auth.ts                    requireAuth JWT cookie verification & userId helper
│   │   ├── error-handler.ts           Centralized JSON error responses
│   │   ├── rate-limit.ts              appLimiter (100/15m) & authLimiter (15/15m)
│   │   ├── request-logger.ts          Request completion logging
│   │   └── security-headers.ts        OWASP HTTP response security headers
│   ├── prisma/
│   │   ├── generated/                 Prisma-generated client artifacts
│   │   ├── migrations/                Prisma SQL schema migrations
│   │   ├── prisma.ts                  PrismaClient with pg.Pool & attachDatabasePool
│   │   └── schema.prisma              Prisma schema (User, Movie, Favorite)
│   ├── routes/
│   │   └── api.routes.ts              API route declarations
│   ├── schemas/
│   │   ├── movie.ts                   Zod schemas for TMDb IDs & movie records
│   │   └── user.ts                    Zod schemas for auth credentials & pagination
│   ├── services/
│   │   ├── auth.ts                    Argon2id hashing/verification & JWT sign/verify helpers
│   │   └── tmdb-proxy.ts              TMDb HTTP client
│   ├── test/
│   │   ├── setup.ts                   Vitest safety guard (blocks remote/Neon DB) & disconnect
│   │   ├── auth.test.ts               Integration tests for /register, /login, /logout, /me
│   │   └── favorites.test.ts          Integration tests for /favorites* (mocked TMDB)
│   ├── types/
│   │   └── express.d.ts               Express Request augmentation (req.userId)
│   ├── validation/
│   │   ├── movie.ts                   Movie & ID validators
│   │   └── user.ts                    Auth body & pagination validators
│   ├── app.ts                         Express app (Vercel serverless entry point)
│   └── server.ts                      Local/VPS HTTP server listener (app.listen)
├── .env.example                       Example environment variable template
├── neon.ts                            Neon branch infrastructure config
├── package.json                       Dependencies and npm scripts
├── prisma.config.ts                   Prisma CLI configuration (uses DATABASE_URL_UNPOOLED)
├── tsconfig.json                      Full TypeScript config (includes tests for typecheck)
├── tsconfig.build.json                Production build config (excludes tests & sandbox)
└── vitest.config.ts                   Vitest configuration (loads .env.test, serial files)
```

## Prerequisites

- Node.js (v20+ recommended) and npm
- A local PostgreSQL instance with separate databases for dev and test (e.g. `movie_browser_dev` and `movie_browser_test`)
- A TMDb Read Access Token (`TMDB_TOKEN`) for live TMDb lookups (not needed for automated tests, which mock TMDb)
- A Neon PostgreSQL database for production

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your gitignored environment files using [`.env.example`](./.env.example) as a reference:
   - **`.env`** and **`.env.development`**: point `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to local `movie_browser_dev`, set `CORS_ORIGIN="http://localhost:5173"`, `JWT_SECRET`, `TMDB_TOKEN`.
   - **`.env.test`**: point `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to local `movie_browser_test`, `NODE_ENV=test`, `JWT_SECRET`, `TMDB_TOKEN="test-tmdb-token"`.
   - **`.env.production`**: point `DATABASE_URL` to your Neon `production` **pooled** (`-pooler`) URL and `DATABASE_URL_UNPOOLED` to the Neon `production` **direct** (non-pooled) URL, set `NODE_ENV=production`, `CORS_ORIGIN="https://movie-browser.haicuong.me"`, and a unique production `JWT_SECRET` (32+ chars).

3. Apply Prisma migrations to your local dev database and generate the client:

   ```bash
   npm run db:migrate:dev
   ```

4. Start the development server with live reload:

   ```bash
   npm run dev
   ```

## Environment configuration

Runtime variables validated by [`src/config/env.ts`](./src/config/env.ts):

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | `development`, `production`, or `test` |
| `PORT` | No | `3000` | HTTP port (`1`–`65535`) used by `src/server.ts` |
| `JWT_SECRET` | Yes | — | Secret key for signing JWTs (min `16` chars; min `32` chars in `production`) |
| `JWT_EXPIRES_IN` | No | `7d` | JWT expiration duration passed to `jsonwebtoken` |
| `CORS_ORIGIN` | Yes | — | Allowed origin(s), comma-separated, trailing slashes stripped (`*` is rejected) |
| `COOKIE_SAME_SITE` | No | `lax` | `lax`, `strict`, or `none` (used when `NODE_ENV=production`; non-prod HTTP always uses `lax`) |
| `TMDB_TOKEN` | Yes | — | TMDb API v3 Bearer token |

Database variables validated by `@neon/env`:

| Variable | Used by | Description |
| --- | --- | --- |
| `DATABASE_URL` | `src/prisma/prisma.ts` | Pooled Postgres connection string (use Neon `-pooler` in production) |
| `DATABASE_URL_UNPOOLED` | `prisma.config.ts` | Direct Postgres connection string required for `prisma migrate` |

> [!IMPORTANT]
> Never commit `.env`, `.env.development`, `.env.production`, or `.env.test`. Only `.env.example` is tracked by Git.

## npm scripts

| Script | Command | Description |
| --- | --- | --- |
| `dev` | `dotenv -e .env.development -- tsx watch src/server.ts` | Run local dev server with watch mode |
| `test` | `vitest` | Run Vitest in watch mode (`pretest` runs `db:migrate:test`) |
| `test:run` | `vitest run` | Run full Vitest suite once |
| `db:migrate:dev` | `dotenv -e .env.development -- prisma migrate dev` | Create/apply migrations on `movie_browser_dev` |
| `db:migrate:test` | `dotenv -e .env.test -- prisma migrate deploy` | Apply committed migrations to `movie_browser_test` |
| `db:migrate:prod` | `dotenv -e .env.production -- prisma migrate deploy` | Apply committed migrations to Neon `production` |
| `db:generate` | `prisma generate` | Regenerate Prisma Client into `src/prisma/generated` |
| `typecheck` | `tsc --noEmit` | Typecheck all TypeScript files including tests |
| `build` | `prisma generate && tsc -p tsconfig.build.json` | Generate Prisma Client and compile production code to `dist/` |
| `vercel-build` | conditional `prisma migrate deploy` + `npm run build` | Vercel build step (migrates only when `VERCEL_ENV === "production"`) |
| `start` | `dotenv -e .env.production -- node dist/server.js` | Run compiled server locally in production mode |

## Testing

Tests run with Vitest and Supertest against the isolated `movie_browser_test` database:
- [`src/test/setup.ts`](./src/test/setup.ts) blocks running tests if `NODE_ENV !== "test"` or if `DATABASE_URL` points to `neon.tech`.
- `fileParallelism: false` in [`vitest.config.ts`](./vitest.config.ts) prevents test files from racing on shared tables.
- TMDb requests are mocked in [`src/test/favorites.test.ts`](./src/test/favorites.test.ts), and all 3 tables (`favorites`, `movies`, `users`) are cleaned before each test and after the suite finishes.

```bash
npm run typecheck
npm run test:run
```

## Example usage (`curl`)

Store and reuse the `HttpOnly` `token` cookie with `-c cookies.txt` and `-b cookies.txt` (browser clients must send `credentials: "include"`):

```bash
# 1. Health check
curl http://localhost:3000/health

# 2. Register (sets token cookie immediately)
curl -i -c cookies.txt -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"StrongPassword123!"}'

# 3. Check current authenticated user
curl -b cookies.txt http://localhost:3000/me

# 4. Add a TMDb movie to favorites (e.g. tmdbId 550)
curl -b cookies.txt -X POST http://localhost:3000/favorites/550

# 5. List favorites (paginated)
curl -b cookies.txt "http://localhost:3000/favorites?page=1&limit=20"

# 6. Get one favorite
curl -b cookies.txt http://localhost:3000/favorites/550

# 7. Delete a favorite
curl -i -b cookies.txt -X DELETE http://localhost:3000/favorites/550

# 8. Logout (clears token cookie)
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:3000/logout
```

For complete request/response schemas and error codes, see [`API_CONTRACT.md`](./API_CONTRACT.md).

## Vercel deployment & Neon

- **Entry point:** Vercel automatically binds [`src/app.ts`](./src/app.ts) (`export default app`) without calling `app.listen()`. [`src/server.ts`](./src/server.ts) is only for local/VPS execution.
- **Build Command:** Set Vercel's Build Command to `npm run vercel-build` (or ensure `vercel-build` runs). When `VERCEL_ENV === "production"`, it runs `npx prisma migrate deploy` as a safety fallback before `npm run build`; Preview builds skip production migrations automatically.
- **Required Vercel Environment Variables (Production):**
  - `DATABASE_URL` = Neon `production` **pooled** URL (`-pooler`)
  - `DATABASE_URL_UNPOOLED` = Neon `production` **direct** URL (used by `prisma migrate deploy` in `vercel-build` and `prisma.config.ts`)
  - `JWT_SECRET` = strong production secret (32+ chars)
  - `TMDB_TOKEN` = TMDb Read Access Token
  - `CORS_ORIGIN` = `https://movie-browser.haicuong.me` (no trailing `/`)
  - *(Do **not** set `NODE_ENV=production` manually in Vercel's UI—Vercel injects it at runtime automatically, and setting it in build env vars can cause `npm install` to skip `devDependencies` like `prisma`.)*
- **TypeScript & dependencies note:** `typescript` is intentionally pinned to `^5.9.3` (and `typescript` + runtime `@types/*` packages live in `dependencies` in `package.json`) because TypeScript 7.x removed `lib/typescript.js`, causing Vercel's `@vercel/node` compiler-executable path to fail with `TS2688: Cannot find type definition file for 'node'`. Upgrade back to `7.x` only after verifying `@vercel/node` supports it.
- **Testing a Vercel Preview deployment:** Scope these overrides to **Preview** in Vercel Environment Variables:
  - `CORS_ORIGIN` = your preview frontend origin(s)
  - `COOKIE_SAME_SITE` = `none` (required if frontend and API previews run on separate `*.vercel.app` subdomains, which browsers treat as cross-site)
  - `DATABASE_URL` & `DATABASE_URL_UNPOOLED` = a Neon dev/preview branch's pooled & direct URLs (`prisma generate` evaluates `prisma.config.ts`)

## Architecture notes & serverless limitations

- **In-memory rate limiting:** `appLimiter` (`100` / 15m) and `authLimiter` (`15` / 15m on `/register` and `/login`) use `express-rate-limit`'s default `MemoryStore`. In Vercel serverless functions, counters are per warm instance and reset on cold starts/redeploys rather than sharing state globally across concurrent instances.
- **In-memory request IDs:** `requestIdCounter` in [`src/middleware/request-logger.ts`](./src/middleware/request-logger.ts) resets to `0` on each serverless cold start and is not globally unique across instances.
- **Shared movie metadata cache:** `POST /favorites/:tmdbId` caches TMDb movie records globally in `movies` by `tmdbId` across all users; subsequent favorites for an already-cached `tmdbId` reuse the database record without calling TMDb again.
