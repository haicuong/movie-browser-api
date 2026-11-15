import { describe, test, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import app from "../app.js";
import { prisma } from "../prisma/prisma.js";
import tmdbRequest from "../services/tmdb-proxy.js";

vi.mock("../services/tmdb-proxy.js", () => ({
  default: vi.fn(),
}));

const TEST_USER = {
  name: "testuser",
  email: "testuser@example.com",
};

const DUMMY_MOVIE = {
  tmdbId: 123,
  title: "Dummy Test Movie",
  overview: "A dummy movie overview used for local Vitest tests.",
  posterPath: "/dummy-poster.jpg",
};

async function cleanDatabase() {
  // Delete favorites first because Favorite -> Movie uses onDelete: Restrict.
  await prisma.favorite.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.user.deleteMany();
}

async function seedDummyMovie(overrides: Partial<typeof DUMMY_MOVIE> = {}) {
  return prisma.movie.create({
    data: {
      ...DUMMY_MOVIE,
      ...overrides,
    },
  });
}

async function seedDummyUser(overrides: Partial<typeof TEST_USER> = {}) {
  return prisma.user.create({
    data: {
      ...TEST_USER,
      ...overrides,
    },
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
});

describe("POST /favorites/:tmdbId", () => {
  test("returns 201 Created and caches movie using mocked TMDB when movie is not in DB", async () => {
    vi.mocked(tmdbRequest).mockResolvedValueOnce({
      success: true,
      body: {
        title: DUMMY_MOVIE.title,
        poster_path: DUMMY_MOVIE.posterPath,
        overview: DUMMY_MOVIE.overview,
      },
    });

    const response = await request(app)
      .post(`/favorites/${DUMMY_MOVIE.tmdbId}`)
      .set("user-name", TEST_USER.name)
      .set("user-email", TEST_USER.email);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      tmdbId: DUMMY_MOVIE.tmdbId,
      title: DUMMY_MOVIE.title,
      poster_path: DUMMY_MOVIE.posterPath,
      overview: DUMMY_MOVIE.overview,
    });
    expect(tmdbRequest).toHaveBeenCalledTimes(1);
    expect(tmdbRequest).toHaveBeenCalledWith(`/movie/${DUMMY_MOVIE.tmdbId}`);
  });

  test("returns 201 Created using dummy movie already in DB without calling TMDB", async () => {
    await seedDummyMovie();

    const response = await request(app)
      .post(`/favorites/${DUMMY_MOVIE.tmdbId}`)
      .set("user-name", TEST_USER.name)
      .set("user-email", TEST_USER.email);

    expect(response.status).toBe(201);
    expect(tmdbRequest).not.toHaveBeenCalled();
  });

  test("returns 404 Not Found when mocked TMDB reports movie does not exist", async () => {
    vi.mocked(tmdbRequest).mockResolvedValueOnce({
      success: false,
      error: "The resource you requested could not be found.",
      statusCode: 404,
    });

    const response = await request(app)
      .post("/favorites/999999")
      .set("user-name", TEST_USER.name)
      .set("user-email", TEST_USER.email);

    expect(response.status).toBe(404);
  });

  test("returns 401 Unauthorized without user headers", async () => {
    const response = await request(app).post(`/favorites/${DUMMY_MOVIE.tmdbId}`);

    expect(response.status).toBe(401);
    expect(tmdbRequest).not.toHaveBeenCalled();
  });
});

describe("GET /favorites", () => {
  test("returns 200 OK with a list of favorite movies", async () => {
    const user = await seedDummyUser();
    const movie = await seedDummyMovie();
    await prisma.favorite.create({
      data: { userId: user.id, tmdbId: movie.tmdbId },
    });

    const response = await request(app)
      .get("/favorites")
      .set("user-name", TEST_USER.name)
      .set("user-email", TEST_USER.email);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([movie]);
  });

  test("returns 200 OK with an empty list when user has no favorites", async () => {
    await seedDummyUser();

    const response = await request(app)
      .get("/favorites")
      .set("user-name", TEST_USER.name)
      .set("user-email", TEST_USER.email);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});

describe("DELETE /favorites/:tmdbId", () => {
  test("returns 204 No Content when a favorite movie is deleted", async () => {
    const user = await seedDummyUser();
    const movie = await seedDummyMovie();
    await prisma.favorite.create({
      data: { userId: user.id, tmdbId: movie.tmdbId },
    });

    const response = await request(app)
      .delete(`/favorites/${movie.tmdbId}`)
      .set("user-name", TEST_USER.name)
      .set("user-email", TEST_USER.email);

    expect(response.status).toBe(204);
    const remaining = await prisma.favorite.findMany();
    expect(remaining).toHaveLength(0);
  });
});

describe("GET /favorites/:tmdbId", () => {
  test("returns 200 OK when a favorite movie exists", async () => {
    const user = await seedDummyUser();
    const movie = await seedDummyMovie();
    await prisma.favorite.create({
      data: { userId: user.id, tmdbId: movie.tmdbId },
    });

    const response = await request(app)
      .get(`/favorites/${movie.tmdbId}`)
      .set("user-name", TEST_USER.name)
      .set("user-email", TEST_USER.email);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(movie);
  });

  test("returns 404 Not Found when no favorite movies exist for user", async () => {
    await seedDummyUser();

    const response = await request(app)
      .get(`/favorites/${DUMMY_MOVIE.tmdbId}`)
      .set("user-name", TEST_USER.name)
      .set("user-email", TEST_USER.email);

    expect(response.status).toBe(404);
  });
});
