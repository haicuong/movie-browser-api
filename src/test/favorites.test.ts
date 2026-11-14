import { describe, test, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app.js";
import { prisma } from "../prisma/prisma.js";

describe("POST /favorites/:tmdbId", () => {
  beforeEach(async () => {
    await prisma.favorite.deleteMany();
  });

  test("returns 201 Created when validation passes", async () => {
    const response = await request(app)
      .post("/favorites/123")
      .set("user-name", "testuser")
      .set("user-email", "testuser@example.com");

    expect(response.status).toBe(201);
  });

  test("returns 401 Unauthorized without user headers", async () => {
    const response = await request(app).post("/favorites/123");

    expect(response.status).toBe(401);
  });
});

describe("GET /favorites", () => {
  beforeEach(async () => {
    await prisma.favorite.deleteMany();
  });

  test("returns 200 OK with a list of favorite movies", async () => {
    const response = await request(app)
      .get("/favorites")
      .set("user-name", "testuser")
      .set("user-email", "testuser@example.com");

    expect(response.status).toBe(200);
  });
});

describe("DELETE /favorites/:tmdbId", () => {
  beforeEach(async () => {
    await prisma.favorite.deleteMany();
  });

  test("returns 204 No Content when a favorite movie is deleted", async () => {
    await request(app)
      .post("/favorites/123")
      .set("user-name", "testuser")
      .set("user-email", "testuser@example.com");

    const response = await request(app)
      .delete("/favorites/123")
      .set("user-name", "testuser")
      .set("user-email", "testuser@example.com");

    expect(response.status).toBe(204);
  });
});

describe("GET /favorites/:tmdbId", () => {
  beforeEach(async () => {
    await prisma.favorite.deleteMany();
  });

  test("returns 200 OK when a favorite movie exists", async () => {
    await request(app)
      .post("/favorites/123")
      .set("user-name", "testuser")
      .set("user-email", "testuser@example.com");

    const response = await request(app)
      .get("/favorites/123")
      .set("user-name", "testuser")
      .set("user-email", "testuser@example.com");

    expect(response.status).toBe(200);
  });

  test("returns 404 Not Found when no favorite movies exist", async () => {
    const response = await request(app)
      .get("/favorites/123")
      .set("user-name", "testuser")
      .set("user-email", "testuser@example.com");

    expect(response.status).toBe(404);
  });
});
