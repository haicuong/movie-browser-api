import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import app from "../app.js";
import env from "../config/env.js";
import { prisma } from "../prisma/prisma.js";

const VALID_CREDENTIALS = {
  email: "alice@example.com",
  password: "StrongPassword123!",
};

async function cleanDatabase() {
  await prisma.favorite.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.user.deleteMany();
}

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
});

describe("POST /register", () => {
  test("returns 201 Created, hashes password with Argon2id, normalizes email, and sets httpOnly cookie", async () => {
    const response = await request(app).post("/register").send({
      email: "  Alice@Example.com  ",
      password: VALID_CREDENTIALS.password,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      email: "alice@example.com",
      createdAt: expect.any(String),
    });
    expect(response.body.passwordHash).toBeUndefined();

    const setCookie = response.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    expect(setCookie[0]).toContain("token=");
    expect(setCookie[0]).toContain("HttpOnly");
    expect(setCookie[0]).toContain("SameSite=Lax");

    const dbUser = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.passwordHash).not.toBe(VALID_CREDENTIALS.password);
    expect(dbUser?.passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  test("returns 409 Conflict when registering a duplicate email (case-insensitive)", async () => {
    await request(app).post("/register").send(VALID_CREDENTIALS);

    const response = await request(app).post("/register").send({
      email: "ALICE@EXAMPLE.COM",
      password: VALID_CREDENTIALS.password,
    });

    expect(response.status).toBe(409);
    expect(response.body.error?.code).toBe("DUPLICATE_ERROR");
  });

  test("returns 400 Validation Error for invalid email or short password", async () => {
    const badEmail = await request(app).post("/register").send({
      email: "not-an-email",
      password: VALID_CREDENTIALS.password,
    });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error?.code).toBe("VALIDATION_ERROR");

    const shortPassword = await request(app).post("/register").send({
      email: VALID_CREDENTIALS.email,
      password: "short",
    });
    expect(shortPassword.status).toBe(400);
    expect(shortPassword.body.error?.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /login", () => {
  beforeEach(async () => {
    await request(app).post("/register").send(VALID_CREDENTIALS);
  });

  test("returns 200 OK and sets auth cookie for valid credentials", async () => {
    const response = await request(app).post("/login").send({
      email: "  ALICE@example.com ",
      password: VALID_CREDENTIALS.password,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: expect.any(Number),
      email: VALID_CREDENTIALS.email,
      createdAt: expect.any(String),
    });
    expect(response.body.passwordHash).toBeUndefined();
    expect(response.headers["set-cookie"]?.[0]).toContain("token=");
  });

  test("returns 401 Unauthorized for wrong password or unknown email", async () => {
    const wrongPassword = await request(app).post("/login").send({
      email: VALID_CREDENTIALS.email,
      password: "WrongPassword123!",
    });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error?.message).toBe("Invalid email or password");

    const unknownEmail = await request(app).post("/login").send({
      email: "nobody@example.com",
      password: VALID_CREDENTIALS.password,
    });
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.error?.message).toBe("Invalid email or password");
  });
});

describe("GET /me & POST /logout", () => {
  test("GET /me returns 200 OK with authenticated user info and no passwordHash", async () => {
    const agent = request.agent(app);
    await agent.post("/register").send(VALID_CREDENTIALS);

    const response = await agent.get("/me");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: expect.any(Number),
      email: VALID_CREDENTIALS.email,
      createdAt: expect.any(String),
    });
    expect(response.body.passwordHash).toBeUndefined();
  });

  test("GET /me returns 401 Unauthorized without cookie, with tampered JWT, or with expired JWT", async () => {
    const noCookie = await request(app).get("/me");
    expect(noCookie.status).toBe(401);

    const tampered = await request(app)
      .get("/me")
      .set("Cookie", ["token=not.a.valid.jwt"]);
    expect(tampered.status).toBe(401);

    const expiredToken = jwt.sign({ userId: 1 }, env.jwtSecret, {
      expiresIn: "-1s",
    });
    const expired = await request(app)
      .get("/me")
      .set("Cookie", [`token=${expiredToken}`]);
    expect(expired.status).toBe(401);
  });

  test("GET /me returns 401 and clears cookie when user no longer exists in DB", async () => {
    const agent = request.agent(app);
    const registerRes = await agent.post("/register").send(VALID_CREDENTIALS);
    await prisma.user.delete({ where: { id: registerRes.body.id } });

    const response = await agent.get("/me");
    expect(response.status).toBe(401);
    expect(response.headers["set-cookie"]?.[0]).toContain("token=;");
  });

  test("POST /logout clears the cookie so subsequent GET /me returns 401", async () => {
    const agent = request.agent(app);
    await agent.post("/register").send(VALID_CREDENTIALS);

    const logoutRes = await agent.post("/logout");
    expect(logoutRes.status).toBe(204);

    const meAfterLogout = await agent.get("/me");
    expect(meAfterLogout.status).toBe(401);
  });
});
