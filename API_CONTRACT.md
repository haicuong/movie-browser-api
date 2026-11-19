# API contract

This document describes the HTTP behavior implemented by the Movie Browser API.

The service is an Express and TypeScript REST API backed by PostgreSQL (Neon) and Prisma ORM. Unless stated otherwise, JSON responses use `Content-Type: application/json`, and request bodies are limited to `10KB`. Examples assume `http://localhost:3000`.

---

## Authentication & cookies

Authentication uses **JWTs stored in an `HttpOnly` cookie** named `token` (signed with `JWT_SECRET`, default expiration `7d`). The JWT payload stores only `{ userId }`.

### Cookie attributes

| Environment | `httpOnly` | `secure` | `sameSite` | `path` | `maxAge` |
| --- | --- | --- | --- | --- | --- |
| Development / Test (`NODE_ENV !== "production"`) | `true` | `false` | `lax` | `/` | 7 days |
| Production (`NODE_ENV === "production"`) | `true` | `true` | `COOKIE_SAME_SITE` (default `lax`) | `/` | 7 days |

- **Browser clients (CORS):** CORS is configured with `credentials: true` for origins listed in `CORS_ORIGIN` (no trailing slash). Browser requests from an allowed origin (such as `https://movie-browser.haicuong.me` talking to a `*.haicuong.me` API subdomain) must include `credentials: "include"` (`withCredentials: true` in Axios) so cookies are stored and sent automatically.
- **Allowed CORS methods & headers:** `GET`, `POST`, `DELETE`, `OPTIONS`; allowed request header `Content-Type`.
- **Cross-site previews:** If a browser frontend and API are deployed on separate sites (such as two different `*.vercel.app` origins), set `COOKIE_SAME_SITE=none` in that environment so `SameSite=None; Secure` cookies are sent cross-site.
- **Protected routes:** `GET /me`, `GET /favorites`, `GET /favorites/:tmdbId`, `POST /favorites/:tmdbId`, and `DELETE /favorites/:tmdbId` require a valid `token` cookie verified by `requireAuth`. Missing, malformed, or expired tokens return `401 UNAUTHORIZED`.

---

## Rate limits

- **Global (`appLimiter`):** `100` requests per `15` minutes per IP across all endpoints (`draft-8` `RateLimit-*` headers).
- **Auth endpoints (`authLimiter`):** `15` requests per `15` minutes per IP on `POST /register` and `POST /login` (skipped when `NODE_ENV === "test"`).
- Exceeding a limit returns `429 Too Many Requests`:
  - Global limit: `{ "error": "Too many requests, please try again later." }`
  - Auth limit: `{ "error": "Too many authentication attempts, please try again later." }`

*(In serverless deployments, `express-rate-limit` uses an in-memory store, so counters are per warm function instance.)*

---

## Data models & validation rules

### Auth credentials (`POST /register`, `POST /login`)

- `email`: string, trimmed and lowercased, must be a valid email format.
- `password`:
  - On `POST /register`: string, `8` to `128` characters.
  - On `POST /login`: string, `1` to `128` characters.

### User response shape

Returned by `POST /register`, `POST /login`, and `GET /me` (never includes `passwordHash`):

```json
{
  "id": 1,
  "email": "alice@example.com",
  "createdAt": "2026-11-16T00:00:00.000Z"
}
```

### Movie representation

- **`POST /favorites/:tmdbId`** returns `201 Created` using `poster_path`:
  ```json
  {
    "tmdbId": 550,
    "title": "Fight Club",
    "poster_path": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    "overview": "A ticking-time-bomb insomniac..."
  }
  ```
- **`GET /favorites` and `GET /favorites/:tmdbId`** return Prisma `Movie` records using `posterPath`:
  ```json
  {
    "tmdbId": 550,
    "title": "Fight Club",
    "overview": "A ticking-time-bomb insomniac...",
    "posterPath": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg"
  }
  ```

### Path & query parameters

- `:tmdbId`: Strict positive 32-bit integer (`1` to `2147483647`, digits only). Non-numeric suffixes, decimals, scientific notation, or values outside the 32-bit integer range return `400 VALIDATION_ERROR` (`"Invalid movie ID"`).
- `?page` (optional on `GET /favorites`): Scalar positive integer (`1` to `10000`, digits only), defaults to `1` when omitted or empty.
- `?limit` (optional on `GET /favorites`): Scalar positive integer (`1` to `100`, digits only), defaults to `20` when omitted or empty.
- Invalid `?page` or `?limit` (including array parameters such as `?page[]=1` or values above the max cap) returns `400 VALIDATION_ERROR`.

---

## Endpoints

### `GET /health`

Confirms that the service is running.

- **Auth:** None
- **Success:** `200 OK`
  ```json
  {
    "status": "ok"
  }
  ```

---

### `POST /register`

Creates a new user account with an Argon2id password hash, sets the `token` cookie immediately, and returns the created user.

- **Auth:** None (`authLimiter`: `15` req / `15`m)
- **Request body:**
  ```json
  {
    "email": "alice@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Success:** `201 Created` + `Set-Cookie: token=<jwt>; HttpOnly; Path=/; SameSite=...`
  ```json
  {
    "id": 1,
    "email": "alice@example.com",
    "createdAt": "2026-11-16T00:00:00.000Z"
  }
  ```
- **Error responses:**
  - `400 VALIDATION_ERROR`: Invalid email, password under 8 or over 128 characters, or invalid JSON payload.
  - `409 DUPLICATE_ERROR`: `"Email is already registered"` (checked after trimming and lowercasing).
  - `429 Too Many Requests`: Auth rate limit exceeded.

---

### `POST /login`

Verifies email and password against the stored Argon2id hash, sets the `token` cookie, and returns the user.

- **Auth:** None (`authLimiter`: `15` req / `15`m)
- **Request body:**
  ```json
  {
    "email": "alice@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Success:** `200 OK` + `Set-Cookie: token=<jwt>; HttpOnly; Path=/; SameSite=...`
  ```json
  {
    "id": 1,
    "email": "alice@example.com",
    "createdAt": "2026-11-16T00:00:00.000Z"
  }
  ```
- **Error responses:**
  - `400 VALIDATION_ERROR`: Invalid email, missing/overlong password, or invalid JSON payload.
  - `401 UNAUTHORIZED`: `"Invalid email or password"` (returned identically for unknown email and wrong password).
  - `429 Too Many Requests`: Auth rate limit exceeded.

---

### `POST /logout`

Clears the `token` cookie using matching cookie attributes.

- **Auth:** None
- **Request body:** None
- **Success:** `204 No Content` (empty body, clears `token` cookie)

---

### `GET /me`

Returns the currently authenticated user's profile from the database.

- **Auth:** Required (`token` cookie)
- **Success:** `200 OK`
  ```json
  {
    "id": 1,
    "email": "alice@example.com",
    "createdAt": "2026-11-16T00:00:00.000Z"
  }
  ```
- **Error responses:**
  - `401 UNAUTHORIZED`: Missing/invalid/expired `token` cookie, or user record no longer exists (also clears cookie).

---

### `GET /favorites`

Returns a paginated list of movies favorited by the authenticated user, ordered by `createdAt` descending.

- **Auth:** Required (`token` cookie)
- **Query parameters:** `page` (default `1`, max `10000`), `limit` (default `20`, max `100`)
- **Success:** `200 OK` (`[]` if no favorites on the requested page)
  ```json
  [
    {
      "tmdbId": 550,
      "title": "Fight Club",
      "overview": "A ticking-time-bomb insomniac...",
      "posterPath": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg"
    }
  ]
  ```
- **Error responses:**
  - `400 VALIDATION_ERROR`: `"Invalid pagination query parameters"`
  - `401 UNAUTHORIZED`: Missing, invalid, or expired `token` cookie.

---

### `GET /favorites/:tmdbId`

Returns a single favorite movie by TMDb ID for the authenticated user.

- **Auth:** Required (`token` cookie)
- **Path parameter:** `tmdbId` (positive integer)
- **Success:** `200 OK`
  ```json
  {
    "tmdbId": 550,
    "title": "Fight Club",
    "overview": "A ticking-time-bomb insomniac...",
    "posterPath": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg"
  }
  ```
- **Error responses:**
  - `400 VALIDATION_ERROR`: `"Invalid movie ID"`
  - `401 UNAUTHORIZED`: Missing, invalid, or expired `token` cookie.
  - `404 NOT_FOUND`: `"Movie with ID <tmdbId> not found in favorites"`

---

### `POST /favorites/:tmdbId`

Adds a movie to the authenticated user's favorites. If the movie already exists in the local `movies` table, the cached metadata is used without calling TMDb. Otherwise, metadata is fetched from TMDb (`/movie/:tmdbId`), validated, upserted into `movies`, and linked in `favorites`.

- **Auth:** Required (`token` cookie)
- **Path parameter:** `tmdbId` (positive integer)
- **Request body:** None
- **Success:** `201 Created`
  ```json
  {
    "tmdbId": 550,
    "title": "Fight Club",
    "poster_path": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    "overview": "A ticking-time-bomb insomniac..."
  }
  ```
- **Error responses:**
  - `400 VALIDATION_ERROR`: `"Invalid movie ID"` or `"Invalid movie request body"` (if upstream TMDb data fails schema validation).
  - `401 UNAUTHORIZED`: Missing/invalid/expired `token` cookie, or user no longer exists in DB (clears cookie).
  - `404 NOT_FOUND`: `"Movie with ID <tmdbId> not found in TMDB"`
  - `409 DUPLICATE_ERROR`: `"Favorite already exists"`
  - `502 BAD_GATEWAY`: `"Failed to fetch movie data from TMDB: <reason>"` (upstream HTTP error, non-JSON/HTML response, network failure, or `5s` timeout).

---

### `DELETE /favorites/:tmdbId`

Removes a movie from the authenticated user's favorites.

- **Auth:** Required (`token` cookie)
- **Path parameter:** `tmdbId` (positive integer)
- **Success:** `204 No Content` (empty body)
- **Error responses:**
  - `400 VALIDATION_ERROR`: `"Invalid movie ID"`
  - `401 UNAUTHORIZED`: Missing, invalid, or expired `token` cookie.
  - `404 NOT_FOUND`: `"Movie with ID <tmdbId> not found in user's favorites"`

---

## Error contract

Application errors return JSON conforming to:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

### Reachable error responses

| HTTP Status | Code | Message | Cause |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Specific Zod issue message / `"Invalid movie ID"` / `"Invalid pagination query parameters"` / `"Invalid JSON payload"` | Request body, query, path parameter, or JSON syntax failed validation |
| `401` | `UNAUTHORIZED` | `"Authentication required"` / `"Invalid or expired authentication token"` / `"Invalid email or password"` / `"User no longer exists"` | Missing/invalid/expired `token` cookie, wrong login credentials, or deleted user |
| `404` | `NOT_FOUND` | `"Route not found"` / `"Movie with ID <tmdbId> not found in TMDB"` / `"Movie with ID <tmdbId> not found in favorites"` / `"Movie with ID <tmdbId> not found in user's favorites"` | Unmatched route or missing movie/favorite |
| `409` | `DUPLICATE_ERROR` | `"Email is already registered"` / `"Favorite already exists"` | Email already exists on `/register` or favorite already exists for user |
| `413` | — *(custom envelope)* | `{ "error": "Payload Too Large", "message": "Request body cannot exceed 10KB." }` | Request body exceeds `10KB` limit |
| `429` | — *(rate-limit envelope)* | `{ "error": "Too many requests..." }` / `{ "error": "Too many authentication attempts..." }` | Exceeded `100` / 15m global or `15` / 15m auth rate limit |
| `502` | `BAD_GATEWAY` | `"Failed to fetch movie data from TMDB: <reason>"` | Upstream TMDb API error or network failure |
| `500` | `INTERNAL_SERVER_ERROR` | `"Internal Server Error"` | Unexpected unhandled exception |

---

## Runtime behavior

- **Request logging:** Every request passes through `requestLogger`, logging an instance-local incrementing ID, method, path, status code, and duration in milliseconds to `stdout`.
- **404 fallback:** Unmatched method/path combinations throw `NotFoundError("Route not found")`.
- **Centralized error handling:** All thrown `AppError` instances, JSON syntax errors, `10KB` payload-too-large errors, and unexpected exceptions are formatted by `errorHandler`.
