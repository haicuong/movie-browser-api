# API contract

This document describes the HTTP behavior implemented by the current source
code. The API has no authentication. Favorites are stored in a process-local
in-memory array, are not associated with users, and are lost when the process
restarts.

Unless stated otherwise, JSON responses use `Content-Type: application/json`.
The examples use `http://localhost:3000`; use the configured `PORT` instead
when it differs.

## Data model and validation

A movie has these required fields:

| Field         | Type             | Rules                                                                                                                      |
| ------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `id`          | positive integer | Must be greater than zero. The validator accepts an integer representation; create responses normalize the ID to a number. |
| `title`       | string           | Required.                                                                                                                  |
| `poster_path` | string or `null` | Required; `null` is allowed.                                                                                               |
| `overview`    | string           | Required.                                                                                                                  |

The request-body validator checks that these fields are present and that
their values have the accepted types. Unknown fields are not rejected. On
creation, the stored response contains only the four movie fields. On
replacement, the validated body is stored as supplied, so additional fields
are retained by the current implementation.

Path IDs must be non-empty strings representing positive integers. Signs are
accepted by the validator, but the resulting ID is compared numerically.

## Endpoints

### `GET /health`

Returns the service health response.

**Request:** no path parameters or body.

**Success:** `200 OK`

```json
{
  "status": "ok"
}
```

### `GET /favorites`

Returns every currently stored favorite in insertion order.

**Request:** no path parameters or body.

**Success:** `200 OK`

```json
[
  {
    "id": 101,
    "title": "Example Movie",
    "poster_path": "/example.jpg",
    "overview": "An example movie overview."
  }
]
```

When there are no favorites, the success body is `[]`.

### `GET /favorites/:id`

Returns one favorite whose numeric ID matches `:id`.

**Path parameter**

- `id`: positive integer representation.

**Request body:** none.

**Success:** `200 OK`, with the movie object.

```json
{
  "id": 101,
  "title": "Example Movie",
  "poster_path": "/example.jpg",
  "overview": "An example movie overview."
}
```

An invalid path ID returns `400`. A valid ID that is not in the in-memory
collection returns `404`.

### `POST /favorites`

Validates and adds a favorite.

**Request body:** JSON object containing the four required movie fields.

```json
{
  "id": 101,
  "title": "Example Movie",
  "poster_path": "/example.jpg",
  "overview": "An example movie overview."
}
```

**Success:** `201 Created`

```json
{
  "id": 101,
  "title": "Example Movie",
  "poster_path": "/example.jpg",
  "overview": "An example movie overview."
}
```

The ID is normalized to a number in the created response. A movie with the
same numeric ID already in the collection returns `409`; the existing item is
not replaced. An invalid body or movie ID returns `400`.

### `PUT /favorites/:id`

Replaces the existing favorite at `:id` with the supplied validated movie object. This is replacement, not a partial update.

**Path parameter**

- `id`: positive integer representation.

**Request body:** JSON object containing `id`, `title`, `poster_path`, and
`overview`. The body `id` must be the same numeric ID as the path parameter.

```json
{
  "id": 101,
  "title": "Updated Example Movie",
  "poster_path": null,
  "overview": "The updated overview."
}
```

**Success:** `200 OK`, with the stored replacement body.

```json
{
  "id": 101,
  "title": "Updated Example Movie",
  "poster_path": null,
  "overview": "The updated overview."
}
```

An invalid path ID, invalid body, or body/path ID mismatch returns `400`. A
valid ID that is not in the collection returns `404`. The controller checks
that the resource exists before validating the replacement body. Duplicate
handling is not separately applied to `PUT`; only the URL-selected item is
replaced.

### `DELETE /favorites/:id`

Removes the favorite at `:id`.

**Path parameter**

- `id`: positive integer representation.

**Request body:** none.

**Success:** `204 No Content` with an empty response body.

An invalid path ID returns `400`. A valid ID that is not in the collection
returns `404`.

## Error contract

Application errors use this exact shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

The currently reachable error responses are:

| Status | Code                    | When                                                                                         |
| ------ | ----------------------- | -------------------------------------------------------------------------------------------- |
| `400`  | `VALIDATION_ERROR`      | Invalid movie ID, invalid request body, or a body/path ID mismatch.                          |
| `400`  | `VALIDATION_ERROR`      | Malformed JSON, with message `Invalid JSON payload`.                                         |
| `404`  | `NOT_FOUND`             | A requested favorite does not exist, or no route matches the request.                        |
| `409`  | `DUPLICATE_ERROR`       | `POST /favorites` uses an ID already in favorites.                                           |
| `500`  | `INTERNAL_SERVER_ERROR` | An unexpected error reaches the centralized handler. The message is `Internal Server Error`. |

Examples:

Invalid movie ID:

```http
GET /favorites/abc
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid movie ID"
  }
}
```

Missing favorite:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Movie with ID 999 not found in favorites"
  }
}
```

Duplicate creation:

```json
{
  "error": {
    "code": "DUPLICATE_ERROR",
    "message": "Movie with ID 101 already exists in favorites"
  }
}
```

Malformed JSON:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid JSON payload"
  }
}
```

An unmatched route uses:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Route not found"
  }
}
```

The error classes also define `UNAUTHORIZED` and `FORBIDDEN`, but no current
route throws those errors, and authentication is not implemented.

## Runtime behavior

Request logging runs before JSON parsing and routes. When a response finishes,
the server logs an incrementing request ID, HTTP method, request path, status
code, and elapsed milliseconds to standard output. The request ID is a log
value only and is not returned by the API.
