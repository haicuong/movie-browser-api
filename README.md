# Movie Browser API

Movie Browser API is a small Express and TypeScript HTTP API for checking
service health and managing a collection of favorite movies. Favorites are
kept in process memory, so this repository currently provides a simple
development API rather than durable, user-specific storage.

## Technology stack

- Node.js with TypeScript
- Express `^5.3.0`
- dotenv `^18.0.7` and dotenv-cli `^11.0.0`
- tsx `^4.23.15` for development execution and watch mode
- TypeScript `^7.0.2`
- ECMAScript modules (`"type": "module"`)

## Features

- `GET /health` health check
- Favorites CRUD:
  - list all favorites
  - retrieve one favorite
  - create a favorite
  - replace a favorite
  - delete a favorite
- Validation for movie IDs and movie request bodies
- Duplicate and missing-resource handling
- Centralized JSON error handling, including malformed JSON
- Request logging with method, path, status code, and duration

## Project structure

```text
.
├── src/
│   ├── config/env.ts             Environment validation and parsed settings
│   ├── controllers/              Favorites request handlers
│   ├── data/favorites.ts         In-memory favorites array
│   ├── errors/errors.ts          Application error classes
│   ├── middleware/
│   │   ├── error-handler.ts      Centralized error responses
│   │   └── request-logger.ts     Request completion logging
│   ├── routes/api.routes.ts      Health and Favorites route definitions
│   ├── types/movie.d.ts          Movie type definition
│   ├── utilities.ts              Movie and movie-ID validation
│   ├── app.ts                    Express middleware and route setup
│   └── server.ts                 HTTP server startup
├── .env.example                  Example environment variable names
├── package.json                  Project metadata and npm scripts
├── package-lock.json             Locked npm dependency versions
└── tsconfig.json                 TypeScript compiler configuration
```

## Prerequisites

- Node.js and npm installed locally
- A supported environment configuration containing `PORT` and `NODE_ENV`

## Local setup

1. Clone the repository and enter its directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create the environment files: `.env.development`, `.env.production` in root, needed for the command you will run. Use `.env.example` as a template, without copying real secrets into the repository. `.env.production` is only for local production-mode test.
4. Start the development server:

   ```bash
   npm run dev
   ```

The server prints the configured port and environment at startup. The
configured `NODE_ENV` must be `development`, `production`, or `test`, and
`PORT` must be an integer from 1 through 65535.

## Environment configuration

The application reads:

- `NODE_ENV`: required; accepted values are `development`, `production`, and
  `test`.
- `PORT`: required; an integer from 1 through 65535.

The npm scripts select environment files with dotenv-cli:

- `.env.development` is used by `npm run dev`.
- `.env.production` is used by `npm start`.
- `.env.test` is available for test-related execution, although no test
  runner is configured in the current scripts.
- `.env.example` documents the required variable names and is the only
  environment file intended to be committed.

Do not commit `.env`, `.env.development`, `.env.production`, `.env.test`, or
any other file containing local environment values, credentials, or tokens.
These files are ignored by the repository's `.gitignore`.

## npm scripts

The scripts below are the exact scripts currently defined in `package.json`:

| Script      | Command                                                 |
| ----------- | ------------------------------------------------------- |
| `test`      | `echo "Error: no test specified" && exit 1`             |
| `dev`       | `dotenv -e .env.development -- tsx watch src/server.ts` |
| `typecheck` | `tsc --noEmit`                                          |
| `build`     | `tsc`                                                   |
| `start`     | `dotenv -e .env.production -- node dist/server.js`      |

## Development, type-checking, and production-like execution

Run the development server with watch mode:

```bash
npm run dev
```

Run the TypeScript type-check without emitting files:

```bash
npm run typecheck
```

Compile TypeScript into `dist/`:

```bash
npm run build
```

After a successful build and a valid `.env.production`, run the compiled
application:

```bash
npm start
```

## Testing with Thunder Client

Start the development server, then create requests in Thunder Client using
the configured local port. The examples below assume `http://localhost:3000`
and use only representative movie data.

Health check:

```http
GET http://localhost:3000/health
```

```json
{ "status": "ok" }
```

Create a favorite:

```http
POST http://localhost:3000/favorites
Content-Type: application/json
```

```json
{
  "id": 101,
  "title": "Example Movie",
  "poster_path": "/example.jpg",
  "overview": "An example movie overview."
}
```

Then use `GET /favorites`, `GET /favorites/101`, `PUT /favorites/101`,
and `DELETE /favorites/101` to exercise the remaining Favorites operations.
The complete request, response, validation, and error contract is in
[`API_CONTRACT.md`](./API_CONTRACT.md).

## Current limitations

- Favorites are held only in memory and reset when the process restarts.
- There is no database.
- Authentication is not implemented; favorites are not stored per user.
- The `test` script is currently a placeholder that exits with an error; no
  automated test runner is configured in `package.json`.

## Future Vercel deployment

Vercel deployment is planned, but this repository does not currently contain
a Vercel configuration, deployment adapter, or verified deployment URL. The
current implementation starts an Express server through `src/server.ts` and
the `start` script, so a future Vercel setup would need to define how that
server is exposed as a Vercel function and provide the required `PORT` and
`NODE_ENV` configuration in the deployment environment.

No deployment should be considered complete based on this README alone.
The repository currently provides no evidence that it has been deployed to
Vercel.