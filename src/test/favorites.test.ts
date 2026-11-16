import request from "supertest";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import app from "../app.js";
import { prisma } from "../prisma/prisma.js";
import tmdbRequest from "../services/tmdb-proxy.js";

vi.mock("../services/tmdb-proxy.js", () => ({
  default: vi.fn(),
}));

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

async function createAuthenticatedAgent(
  email: string = "testuser@example.com",
  password: string = "TestPassword123!",
) {
  const agent = request.agent(app);
  const res = await agent.post("/register").send({ email, password });
  expect(res.status).toBe(201);
  return { agent, userId: res.body.id as number };
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
    const { agent } = await createAuthenticatedAgent();
    vi.mocked(tmdbRequest).mockResolvedValueOnce({
      success: true,
      body: {
        title: DUMMY_MOVIE.title,
        poster_path: DUMMY_MOVIE.posterPath,
        overview: DUMMY_MOVIE.overview,
      },
    });

    const response = await agent.post(`/favorites/${DUMMY_MOVIE.tmdbId}`);

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
    const { agent } = await createAuthenticatedAgent();
    await seedDummyMovie();

    const response = await agent.post(`/favorites/${DUMMY_MOVIE.tmdbId}`);

    expect(response.status).toBe(201);
    expect(tmdbRequest).not.toHaveBeenCalled();
  });

  test("returns 409 Conflict when favoriting the same movie twice", async () => {
    const { agent } = await createAuthenticatedAgent();
    await seedDummyMovie();

    const first = await agent.post(`/favorites/${DUMMY_MOVIE.tmdbId}`);
    expect(first.status).toBe(201);

    const second = await agent.post(`/favorites/${DUMMY_MOVIE.tmdbId}`);
    expect(second.status).toBe(409);
    expect(second.body.error?.code).toBe("DUPLICATE_ERROR");
  });

  test("returns 404 Not Found when mocked TMDB reports movie does not exist", async () => {
    const { agent } = await createAuthenticatedAgent();
    vi.mocked(tmdbRequest).mockResolvedValueOnce({
      success: false,
      error: "The resource you requested could not be found.",
      statusCode: 404,
    });

    const response = await agent.post("/favorites/999999");

    expect(response.status).toBe(404);
  });

  test("returns 401 Unauthorized without auth cookie", async () => {
    const response = await request(app).post(
      `/favorites/${DUMMY_MOVIE.tmdbId}`,
    );

    expect(response.status).toBe(401);
    expect(tmdbRequest).not.toHaveBeenCalled();
  });
});

describe("GET /favorites", () => {
  test("returns 200 OK with only the authenticated user's favorite movies", async () => {
    const { agent: aliceAgent, userId: aliceId } =
      await createAuthenticatedAgent("alice@example.com");
    const { userId: bobId } = await createAuthenticatedAgent("bob@example.com");

    const aliceMovie = await seedDummyMovie({ tmdbId: 123, title: "Alice Movie" });
    const bobMovie = await seedDummyMovie({ tmdbId: 456, title: "Bob Movie" });

    await prisma.favorite.create({
      data: { userId: aliceId, tmdbId: aliceMovie.tmdbId },
    });
    await prisma.favorite.create({
      data: { userId: bobId, tmdbId: bobMovie.tmdbId },
    });

    const response = await aliceAgent.get("/favorites");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([aliceMovie]);
  });

  test("returns 200 OK with an empty list when user has no favorites", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent.get("/favorites");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test("returns 401 Unauthorized without auth cookie", async () => {
    const response = await request(app).get("/favorites");
    expect(response.status).toBe(401);
  });
});

describe("DELETE /favorites/:tmdbId", () => {
  test("returns 204 No Content when the authenticated user's favorite is deleted", async () => {
    const { agent, userId } = await createAuthenticatedAgent();
    const movie = await seedDummyMovie();
    await prisma.favorite.create({
      data: { userId, tmdbId: movie.tmdbId },
    });

    const response = await agent.delete(`/favorites/${movie.tmdbId}`);

    expect(response.status).toBe(204);
    const remaining = await prisma.favorite.findMany();
    expect(remaining).toHaveLength(0);
  });

  test("returns 404 Not Found when trying to delete another user's favorite", async () => {
    const { userId: aliceId } = await createAuthenticatedAgent(
      "alice@example.com",
    );
    const { agent: bobAgent } = await createAuthenticatedAgent("bob@example.com");
    const movie = await seedDummyMovie();
    await prisma.favorite.create({
      data: { userId: aliceId, tmdbId: movie.tmdbId },
    });

    const response = await bobAgent.delete(`/favorites/${movie.tmdbId}`);
    expect(response.status).toBe(404);
  });

  test("returns 401 Unauthorized without auth cookie", async () => {
    const response = await request(app).delete(
      `/favorites/${DUMMY_MOVIE.tmdbId}`,
    );
    expect(response.status).toBe(401);
  });
});

describe("GET /favorites/:tmdbId", () => {
  test("returns 200 OK when a favorite movie exists", async () => {
    const { agent, userId } = await createAuthenticatedAgent();
    const movie = await seedDummyMovie();
    await prisma.favorite.create({
      data: { userId, tmdbId: movie.tmdbId },
    });

    const response = await agent.get(`/favorites/${movie.tmdbId}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(movie);
  });

  test("returns 404 Not Found when no favorite movies exist for user", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent.get(`/favorites/${DUMMY_MOVIE.tmdbId}`);

    expect(response.status).toBe(404);
  });

  test("returns 401 Unauthorized without auth cookie", async () => {
    const response = await request(app).get(`/favorites/${DUMMY_MOVIE.tmdbId}`);
    expect(response.status).toBe(401);
  });
});
