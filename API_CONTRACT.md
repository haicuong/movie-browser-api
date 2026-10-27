# API contract

This document describes the HTTP behavior implemented by the Movie Browser API.

The service is an Express and TypeScript REST API backed by PostgreSQL and Prisma ORM. Favorites are stored persistently per user. Requests to favorites endpoints identify the acting user through custom HTTP request headers.

Unless stated otherwise, JSON responses use `Content-Type: application/json`. The examples use `http://localhost:3000`; use the configured `PORT` when it differs.

---

## User identification headers

Authentication is currently header-based. Requests to all `/favorites` endpoints require two user headers:

| Header       | Type   | Rules                                                                                                                                           |
| ------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `user-email` | string | Required. Must be a valid email format matching `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` after trimming.                                                  |
| `user-name`  | string | Required. Must be a non-empty string between 2 and 50 characters in length after trimming.                                                    |

### User resolution behavior

- **`POST /favorites`**: Looks up the user in the database by `email` and `name`. If the user record does not exist, the user is automatically created with the provided credentials.
- **`GET /favorites`**, **`GET /favorites/:tmdbId`**, **`PUT /favorites/:tmdbId`**, **`DELETE /favorites/:tmdbId`**: Looks up the user by `email` and `name`. If no matching user exists in the database, the request fails with `404 NOT_FOUND` (`"User not found"`).
- Missing, empty, or invalid user headers immediately return `400 VALIDATION_ERROR`.

---

## Data models and validation

### Movie model

A movie represents TMDb (The Movie Database) metadata.

#### Request body schema (`POST`, `PUT`)

Requests sending a movie body must provide a JSON object with the following required fields:

| Field         | Type             | Rules                                                                                  |
| ------------- | ---------------- | -------------------------------------------------------------------------------------- |
| `tmdbId`      | positive integer | Positive number (`> 0`, integer). Identifies the movie in TMDb.                        |
| `title`       | string           | Required movie title string.                                                           |
| `overview`    | string           | Required movie summary/synopsis string.                                                |
| `poster_path` | string or `null` | Required poster image path (string or explicit `null`).                                |

The movie body validator verifies that all four fields exist and match the accepted types. Unknown additional properties are tolerated by the validator.

#### Response representation

- **`POST /favorites`**: Returns `201 Created` with the movie object formatted using the input property name `poster_path`:
  ```json
  {
    "tmdbId": 101,
    "title": "Example Movie",
    "poster_path": "/example.jpg",
    "overview": "An example movie overview."
  }
  ```
- **Database query responses (`GET /favorites`, `GET /favorites/:tmdbId`, `PUT /favorites/:tmdbId`)**: Return records directly from Prisma ORM, where the database column `poster_path` is mapped to the camelCase property `posterPath`:
  ```json
  {
    "tmdbId": 101,
    "title": "Example Movie",
    "overview": "An example movie overview.",
    "posterPath": "/example.jpg"
  }
  ```

### Path parameters

- `:tmdbId`: String representation of a positive integer (e.g. `/favorites/101`). Parsed via `parseInt(tmdbId, 10)`. Must be greater than `0`. If invalid or non-numeric, the API returns `400 VALIDATION_ERROR` with message `"Invalid movie ID"`.

### Query parameters

- `page`: Optional query parameter on `GET /favorites` (e.g. `?page=2`). Parsed via `parseInt(page, 10)`. Defaults to `1` when omitted or empty. If provided and invalid (non-integer, `<= 0`, or non-numeric), returns `400 VALIDATION_ERROR` with message `"Invalid page number"`.

---

## Endpoints

### `GET /health`

Health check endpoint. Confirms that the Express service is operational.

**Headers:** None required.

**Request:** No parameters or body.

**Success:** `200 OK`

```json
{
  "status": "ok"
}
```

---

### `GET /favorites`

Returns a paginated list of movies favorited by the identified user.

**Headers:**
- `user-email`: string (required)
- `user-name`: string (required)

**Query parameters:**
- `page` (optional): Positive integer page number. Defaults to `1`.

**Pagination & ordering:**
- Items per page: `20` (`take: 20`, `skip: (page - 1) * 20`).
- Order: Sorted by favorite addition timestamp descending (`createdAt: "desc"`).

**Success:** `200 OK`

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

When the user has no favorites on the requested page, returns an empty array `[]`.

**Error responses:**
- `400 Bad Request` (`VALIDATION_ERROR`): Missing or invalid user headers (`"Invalid user email header"` or `"Invalid user name header"`), or invalid page query parameter (`"Invalid page number"`).
- `404 Not Found` (`NOT_FOUND`): User does not exist in the database (`"User not found"`).

---

### `GET /favorites/:tmdbId`

Returns a single favorite movie by its TMDb ID for the identified user.

**Headers:**
- `user-email`: string (required)
- `user-name`: string (required)

**Path parameter:**
- `tmdbId`: Positive integer TMDb movie ID.

**Request body:** None.

**Success:** `200 OK`

```json
{
  "tmdbId": 101,
  "title": "Example Movie",
  "overview": "An example movie overview.",
  "posterPath": "/example.jpg"
}
```

**Error responses:**
- `400 Bad Request` (`VALIDATION_ERROR`): Missing or invalid user headers, or invalid `:tmdbId` path parameter (`"Invalid movie ID"`).
- `404 Not Found` (`NOT_FOUND`):
  - User not found in database (`"User not found"`).
  - Favorite not found for this user (`"Movie with ID <tmdbId> not found in favorites"`).

---

### `POST /favorites`

Adds a movie to the identified user's favorites collection. If the user does not already exist in the database, the user record is automatically provisioned. If the movie does not already exist in the database, it is created; if it does exist, its title, overview, and poster path are updated.

**Headers:**
- `user-email`: string (required)
- `user-name`: string (required)

**Request body:** JSON object with movie fields.

```json
{
  "tmdbId": 101,
  "title": "Example Movie",
  "poster_path": "/example.jpg",
  "overview": "An example movie overview."
}
```

**Success:** `201 Created`

```json
{
  "tmdbId": 101,
  "title": "Example Movie",
  "poster_path": "/example.jpg",
  "overview": "An example movie overview."
}
```

**Error responses:**
- `400 Bad Request` (`VALIDATION_ERROR`):
  - Missing or invalid user headers (`"Invalid user email header"`, `"Invalid user name header"`).
  - Invalid movie request body (`"Invalid movie request body"`).
  - Malformed JSON payload (`"Invalid JSON payload"`).
- `409 Conflict` (`DUPLICATE_ERROR`): The movie is already in this user's favorites (`"Favorite already exists"`).

---

### `PUT /favorites/:tmdbId`

Replaces/updates movie details for an existing user favorite. This operation checks that the movie is already in the user's favorites and verifies that the `tmdbId` in the request body matches `:tmdbId` in the URL, then updates the shared movie record in the database.

**Headers:**
- `user-email`: string (required)
- `user-name`: string (required)

**Path parameter:**
- `tmdbId`: Positive integer TMDb movie ID.

**Request body:** JSON object containing replacement movie details. The body `tmdbId` must match the URL `:tmdbId`.

```json
{
  "tmdbId": 101,
  "title": "Updated Example Movie",
  "poster_path": null,
  "overview": "The updated overview."
}
```

**Success:** `200 OK`

```json
{
  "tmdbId": 101,
  "title": "Updated Example Movie",
  "overview": "The updated overview.",
  "posterPath": null
}
```

**Error responses:**
- `400 Bad Request` (`VALIDATION_ERROR`):
  - Missing or invalid user headers (`"Invalid user email header"`, `"Invalid user name header"`).
  - Invalid `:tmdbId` path parameter (`"Invalid movie ID"`).
  - Invalid movie request body (`"Invalid movie request body"`).
  - ID mismatch between URL and body (`"Movie ID in the body does not match the ID in the URL"`).
  - Malformed JSON payload (`"Invalid JSON payload"`).
- `404 Not Found` (`NOT_FOUND`):
  - User not found in database (`"User not found"`).
  - Movie not in user's favorites (`"Favorite with ID <tmdbId> not found"`).

---

### `DELETE /favorites/:tmdbId`

Removes a movie from the identified user's favorites collection.

**Headers:**
- `user-email`: string (required)
- `user-name`: string (required)

**Path parameter:**
- `tmdbId`: Positive integer TMDb movie ID.

**Request body:** None.

**Success:** `204 No Content` with an empty response body.

**Error responses:**
- `400 Bad Request` (`VALIDATION_ERROR`): Missing or invalid user headers, or invalid `:tmdbId` path parameter (`"Invalid movie ID"`).
- `404 Not Found` (`NOT_FOUND`):
  - User not found in database (`"User not found"`).
  - Movie not found in user's favorites (`"Movie with ID <tmdbId> not found in user's favorites"`).

---

## Error contract

Application errors return JSON conforming to this uniform structure:

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
| ----------- | ---- | ------- | ----- |
| `400` | `VALIDATION_ERROR` | `Invalid user email header` | `user-email` header missing, empty, or not a valid email format |
| `400` | `VALIDATION_ERROR` | `Invalid user name header` | `user-name` header missing, empty, or length not between 2 and 50 characters |
| `400` | `VALIDATION_ERROR` | `Invalid movie ID` | `:tmdbId` path parameter is not a positive integer |
| `400` | `VALIDATION_ERROR` | `Invalid page number` | `?page` query parameter is not a positive integer |
| `400` | `VALIDATION_ERROR` | `Invalid movie request body` | Body is not an object or fails validation for required fields (`tmdbId`, `title`, `overview`, `poster_path`) |
| `400` | `VALIDATION_ERROR` | `Movie ID in the body does not match the ID in the URL` | In `PUT /favorites/:tmdbId`, `body.tmdbId` differs from `:tmdbId` in the URL |
| `400` | `VALIDATION_ERROR` | `Invalid JSON payload` | Malformed or non-parseable JSON request body |
| `404` | `NOT_FOUND` | `Route not found` | The requested HTTP method and path do not match any defined route |
| `404` | `NOT_FOUND` | `User not found` | No matching user in the database for `GET`, `PUT`, or `DELETE` favorites requests |
| `404` | `NOT_FOUND` | `Movie with ID <tmdbId> not found in favorites` | `GET /favorites/:tmdbId`: favorite does not exist for this user |
| `404` | `NOT_FOUND` | `Favorite with ID <tmdbId> not found` | `PUT /favorites/:tmdbId`: favorite does not exist for this user |
| `404` | `NOT_FOUND` | `Movie with ID <tmdbId> not found in user's favorites` | `DELETE /favorites/:tmdbId`: favorite does not exist for this user |
| `409` | `DUPLICATE_ERROR` | `Favorite already exists` | `POST /favorites`: movie is already in this user's favorites |
| `500` | `INTERNAL_SERVER_ERROR` | `Internal Server Error` | An unexpected unhandled exception occurred |

### Error response examples

**Invalid user email header:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid user email header"
  }
}
```

**Invalid movie ID:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid movie ID"
  }
}
```

**User not found:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}
```

**Favorite movie not found:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Movie with ID 999 not found in favorites"
  }
}
```

**Duplicate favorite:**
```json
{
  "error": {
    "code": "DUPLICATE_ERROR",
    "message": "Favorite already exists"
  }
}
```

**ID mismatch:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Movie ID in the body does not match the ID in the URL"
  }
}
```

**Malformed JSON:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid JSON payload"
  }
}
```

**Unmatched route:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Route not found"
  }
}
```

> [!NOTE]
> The `errors.ts` module also defines `UnauthorizedError` (`401 UNAUTHORIZED`) and `ForbiddenError` (`403 FORBIDDEN`), but currently no route throws these errors. Full authentication (e.g. passwords or tokens) is planned for a future release.

---

## Runtime behavior

- **Request logging:** All requests pass through `requestLogger` before JSON body parsing and routing. Upon response completion, the server logs an incrementing request ID, HTTP method, request path, HTTP status code, and execution duration in milliseconds to `stdout`.
- **404 fallback handler:** Any request path or method not handled by defined routes falls through to an Express catch-all handler throwing a `NotFoundError("Route not found")`.
- **Centralized error handling:** All errors (whether instances of `AppError`, JSON parsing syntax errors, or unhandled exceptions) are caught by the `errorHandler` middleware and rendered into the uniform JSON error response.
