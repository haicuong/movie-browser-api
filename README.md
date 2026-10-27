# Movie Browser API

Movie Browser API is an Express and TypeScript HTTP API for checking service health and managing user favorite movies. Favorites are stored persistently per user in a PostgreSQL database managed via Prisma ORM.

## Technology stack

- Node.js with TypeScript
- Express `^5.3.0`
- Prisma ORM `^7.10.1` (`prisma` CLI, `@prisma/client`, and `@prisma/adapter-pg`)
- PostgreSQL database with `pg` `^8.23.1`
- dotenv `^18.0.7` and dotenv-cli `^11.0.0`
- tsx `^4.23.15` for development execution and watch mode
- TypeScript `^7.0.2`
- ECMAScript modules (`"type": "module"`)

## Features

- `GET /health` health check
- User-scoped Favorites CRUD:
  - List favorites with pagination (`?page=`, 20 per page, sorted by creation date descending)
  - Retrieve one favorite by TMDb ID (`GET /favorites/:tmdbId`)
  - Create a favorite (with automatic user creation if the user does not exist yet)
  - Replace/update favorite movie metadata (`PUT /favorites/:tmdbId`)
  - Delete a favorite (`DELETE /favorites/:tmdbId`)
- User identification via request headers (`user-email`, `user-name`)
- Persistent PostgreSQL storage with relational schema (`User`, `Movie`, `Favorite` join table)
- Robust validation for TMDb movie IDs, request bodies, query parameters, and user headers
- Duplicate favorite prevention (`409 DUPLICATE_ERROR`) and missing-resource handling (`404 NOT_FOUND`)
- Centralized JSON error handling, including malformed JSON payloads
- Request logging with method, path, status code, and duration

## Project structure

```text
.
├── src/
│   ├── config/
│   │   └── env.ts                     Environment validation and parsed settings
│   ├── controllers/
│   │   ├── create-favorite.controller.ts   Add a movie to user favorites
│   │   ├── delete-favorite.controller.ts   Remove a movie from user favorites
│   │   ├── get-favorite.controller.ts      Retrieve a single favorite movie
│   │   ├── list-favorites.controller.ts    List user favorites with pagination
│   │   └── replace-favorite.controller.ts  Update/replace favorite movie details
│   ├── errors/
│   │   └── errors.ts                  Application error classes
│   ├── middleware/
│   │   ├── error-handler.ts           Centralized error responses
│   │   └── request-logger.ts          Request completion logging
│   ├── prisma/
│   │   ├── generated/                 Prisma-generated client artifacts
│   │   ├── migrations/                Prisma database schema migrations
│   │   ├── prisma.ts                  Prisma client instance with PostgreSQL adapter
│   │   └── schema.prisma              Prisma schema (User, Movie, Favorite)
│   ├── routes/
│   │   └── api.routes.ts              API route declarations
│   ├── types/
│   │   └── movie.d.ts                 Movie TypeScript type definitions
│   ├── utilities.ts                   Validation helpers and database user queries
│   ├── app.ts                         Express middleware and route registration
│   └── server.ts                      HTTP server startup
├── prisma.config.ts                   Prisma configuration file
├── .env.example                       Example environment variable template
├── package.json                       Dependencies and npm scripts
├── package-lock.json                  Locked npm dependency versions
└── tsconfig.json                      TypeScript compiler configuration
```

## Prerequisites

- Node.js (v20+ recommended) and npm installed locally
- A running PostgreSQL database instance
- A configured environment containing `PORT`, `NODE_ENV`, and `DATABASE_URL`

## Local setup

1. Clone the repository and enter its directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create your environment files:
   - Create `.env` and `.env.development` (for development) and optionally `.env.production` (for local production testing).
   - Use `.env.example` as a template:

     ```dotenv
     PORT=3000
     NODE_ENV=development
     DATABASE_URL="postgresql://postgres:password@localhost:5432/movie_browser_dev?schema=public"
     ```

4. Run Prisma database migrations to create the required tables:

   ```bash
   npx prisma migrate dev
   ```

5. Start the development server with live reload:

   ```bash
   npm run dev
   ```

The server prints the configured port and environment mode at startup (e.g. `Server is running on port 3000 in development mode.`).

## Environment configuration

The application reads:

- `NODE_ENV`: required; accepted values are `development`, `production`, and `test`.
- `PORT`: required; an integer from 1 through 65535. In `development` or `test` mode, defaults to `3000` if omitted or invalid.
- `DATABASE_URL`: required; PostgreSQL connection string used by Prisma client and migrations.

The npm scripts select environment files via `dotenv-cli`:

- `.env.development` is loaded by `npm run dev`.
- `.env.production` is loaded by `npm start`.
- `.env` is loaded automatically by Prisma and `dotenv/config`.
- `.env.example` documents example environment variables and is safe to commit.

Do not commit `.env`, `.env.development`, `.env.production`, or `.env.test`. These files are ignored by the repository's `.gitignore`.

## npm scripts

The scripts below are defined in `package.json`:

| Script      | Command                                                 | Description                               |
| ----------- | ------------------------------------------------------- | ----------------------------------------- |
| `dev`       | `dotenv -e .env.development -- tsx watch src/server.ts` | Runs the server in watch mode with `tsx`  |
| `typecheck` | `tsc --noEmit`                                          | Checks TypeScript types without emitting  |
| `build`     | `tsc`                                                   | Compiles TypeScript to `dist/`            |
| `start`     | `dotenv -e .env.production -- node dist/server.js`      | Runs the compiled application             |
| `test`      | `echo "Error: no test specified" && exit 1`             | Test runner placeholder                  |

### Useful Prisma commands

- `npx prisma migrate dev`: Applies migrations to the development database.
- `npx prisma generate`: Generates the Prisma Client into `src/prisma/generated`.
- `npx prisma studio`: Launches an interactive browser UI to view and manage database data.

## Development, type-checking, and production execution

Run the development server with watch mode:

```bash
npm run dev
```

Run TypeScript type-checking without emitting files:

```bash
npm run typecheck
```

Compile TypeScript into `dist/`:

```bash
npm run build
```

After building and ensuring valid production environment variables in `.env.production` and `.env`, run the compiled application:

```bash
npm start
```

## Testing with Thunder Client or cURL

The examples below assume `http://localhost:3000`. Note that all `/favorites` endpoints require `user-email` and `user-name` headers.

### 1. Health check

```http
GET http://localhost:3000/health
```

```json
{
  "status": "ok"
}
```

### 2. Create a favorite

If the user does not exist in the database, `POST /favorites` automatically provisions the user record.

```http
POST http://localhost:3000/favorites
user-email: alice@example.com
user-name: Alice
Content-Type: application/json
```

```json
{
  "tmdbId": 101,
  "title": "Example Movie",
  "poster_path": "/example.jpg",
  "overview": "An example movie overview."
}
```

Response (`201 Created`):

```json
{
  "tmdbId": 101,
  "title": "Example Movie",
  "poster_path": "/example.jpg",
  "overview": "An example movie overview."
}
```

### 3. List favorites (with optional pagination)

```http
GET http://localhost:3000/favorites?page=1
user-email: alice@example.com
user-name: Alice
```

Response (`200 OK`):

```json
[
  {
    "tmdbId": 101,
    "title": "Example Movie",
    "overview": "An example movie overview.",
    "posterPath": "/example.jpg"
  }
]
```

### 4. Retrieve one favorite

```http
GET http://localhost:3000/favorites/101
user-email: alice@example.com
user-name: Alice
```

Response (`200 OK`):

```json
{
  "tmdbId": 101,
  "title": "Example Movie",
  "overview": "An example movie overview.",
  "posterPath": "/example.jpg"
}
```

### 5. Replace a favorite movie's details

```http
PUT http://localhost:3000/favorites/101
user-email: alice@example.com
user-name: Alice
Content-Type: application/json
```

```json
{
  "tmdbId": 101,
  "title": "Updated Example Movie",
  "poster_path": null,
  "overview": "The updated overview."
}
```

Response (`200 OK`):

```json
{
  "tmdbId": 101,
  "title": "Updated Example Movie",
  "overview": "The updated overview.",
  "posterPath": null
}
```

### 6. Delete a favorite

```http
DELETE http://localhost:3000/favorites/101
user-email: alice@example.com
user-name: Alice
```

Response: `204 No Content` (empty body).

For full details on request headers, validations, parameter rules, and error envelopes, refer to [`API_CONTRACT.md`](./API_CONTRACT.md).

## Current limitations

- **Header-based user identification**: Authentication currently relies on `user-email` and `user-name` headers. Full credential- or token-based authentication (e.g. passwords, JWT, OAuth) is planned for a future release.
- **Shared movie catalog**: When creating or replacing a favorite, movie metadata in the `movies` table is upserted globally by `tmdbId` across all users.
- **Automated test suite**: The `test` script in `package.json` is a placeholder; an automated test runner (such as Vitest or Jest) has not yet been configured.

## Future Vercel deployment

A future Vercel deployment would expose the Express application as a serverless function handler. In a serverless environment:
- Connection pooling or a direct serverless-compatible connection string for PostgreSQL via `DATABASE_URL` is required.
- Environment variables (`PORT`, `NODE_ENV`, `DATABASE_URL`) must be set in Vercel project settings.
- Prisma engine binary / client generation (`prisma generate`) should be integrated into the Vercel build step.
