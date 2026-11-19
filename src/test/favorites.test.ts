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

  test("returns 400 VALIDATION_ERROR for non-digit suffixes and INT4 overflow movie IDs", async () => {
    const { agent } = await createAuthenticatedAgent();

    for (const invalidId of ["550abc", "550.9", "550e2", "2147483648", "99999999999"]) {
      const response = await agent.post(`/favorites/${invalidId}`);
      expect(response.status).toBe(400);
      expect(response.body.error).toEqual({
        code: "VALIDATION_ERROR",
        message: "Invalid movie ID",
      });
    }
    expect(tmdbRequest).not.toHaveBeenCalled();
  });

  test("returns 502 BAD_GATEWAY when upstream TMDB returns HTTP 200 with non-JSON HTML body", async () => {
    const { agent } = await createAuthenticatedAgent();
    const { default: actualTmdbRequest } = await vi.importActual<
      typeof import("../services/tmdb-proxy.js")
    >("../services/tmdb-proxy.js");
    vi.mocked(tmdbRequest).mockImplementationOnce(actualTmdbRequest);

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("<html><body>Bad Gateway</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );

    try {
      const response = await agent.post(`/favorites/${DUMMY_MOVIE.tmdbId}`);
      expect(response.status).toBe(502);
      expect(response.body.error?.code).toBe("BAD_GATEWAY");
      expect(response.body.error?.message).toContain(
        "Invalid JSON response from TMDB",
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test("returns 502 BAD_GATEWAY when upstream TMDB request times out", async () => {
    const { agent } = await createAuthenticatedAgent();
    const { default: actualTmdbRequest } = await vi.importActual<
      typeof import("../services/tmdb-proxy.js")
    >("../services/tmdb-proxy.js");
    vi.mocked(tmdbRequest).mockImplementationOnce(actualTmdbRequest);

    const timeoutErr = new DOMException(
      "The operation was aborted due to timeout",
      "TimeoutError",
    );
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(timeoutErr);

    try {
      const response = await agent.post(`/favorites/${DUMMY_MOVIE.tmdbId}`);
      expect(response.status).toBe(502);
      expect(response.body.error?.code).toBe("BAD_GATEWAY");
      expect(response.body.error?.message).toContain("TMDB request timed out");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test("coalesces concurrent cache-miss TMDB lookups for the same uncached movie", async () => {
    const agents = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createAuthenticatedAgent(`coalesce-${i}@example.com`),
      ),
    );

    vi.mocked(tmdbRequest).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        success: true,
        body: {
          title: DUMMY_MOVIE.title,
          poster_path: DUMMY_MOVIE.posterPath,
          overview: DUMMY_MOVIE.overview,
        },
      };
    });

    const responses = await Promise.all(
      agents.map(({ agent }) => agent.post(`/favorites/${DUMMY_MOVIE.tmdbId}`)),
    );

    for (const response of responses) {
      expect(response.status).toBe(201);
    }
    expect(tmdbRequest).toHaveBeenCalledTimes(1);

    const storedFavorites = await prisma.favorite.findMany({
      where: { tmdbId: DUMMY_MOVIE.tmdbId },
    });
    expect(storedFavorites).toHaveLength(5);
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

  test("returns 400 VALIDATION_ERROR for out-of-range pagination or array query params", async () => {
    const { agent } = await createAuthenticatedAgent();

    for (const query of [
      "?limit=101",
      "?limit=1000000",
      "?page=10001",
      "?page[]=1",
      "?page=1&page=2",
      "?limit=1.5",
    ]) {
      const response = await agent.get(`/favorites${query}`);
      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe("VALIDATION_ERROR");
    }
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

  test("returns 400 VALIDATION_ERROR for suffix-truncated ('550abc') and INT4-overflow ('2147483648') movie IDs", async () => {
    const { agent, userId } = await createAuthenticatedAgent();
    const movie = await seedDummyMovie({ tmdbId: 550 });
    await prisma.favorite.create({
      data: { userId, tmdbId: movie.tmdbId },
    });

    const suffixRes = await agent.get("/favorites/550abc");
    expect(suffixRes.status).toBe(400);
    expect(suffixRes.body.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Invalid movie ID",
    });

    const overflowRes = await agent.get("/favorites/2147483648");
    expect(overflowRes.status).toBe(400);
    expect(overflowRes.body.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Invalid movie ID",
    });
  });
});
