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

    const expiredToken = jwt.sign(
      { userId: 1, tokenVersion: 1 },
      env.jwtSecret,
      {
        expiresIn: "-1s",
      },
    );
    const expired = await request(app)
      .get("/me")
      .set("Cookie", [`token=${expiredToken}`]);
    expect(expired.status).toBe(401);

    const missingVersionToken = jwt.sign({ userId: 1 }, env.jwtSecret, {
      algorithm: "HS256",
      expiresIn: "1h",
    });
    const missingVersion = await request(app)
      .get("/me")
      .set("Cookie", [`token=${missingVersionToken}`]);
    expect(missingVersion.status).toBe(401);
  });

  test("protected routes return 401 and clear cookie when user no longer exists in DB", async () => {
    const registerRes = await request(app)
      .post("/register")
      .send(VALID_CREDENTIALS);
    const cookieHeader = registerRes.headers["set-cookie"]?.[0]?.split(";")[0];
    expect(cookieHeader).toBeDefined();

    await prisma.user.delete({ where: { id: registerRes.body.id } });

    const meRes = await request(app).get("/me").set("Cookie", [cookieHeader!]);
    expect(meRes.status).toBe(401);
    expect(meRes.headers["set-cookie"]?.[0]).toContain("token=;");

    const listRes = await request(app)
      .get("/favorites")
      .set("Cookie", [cookieHeader!]);
    expect(listRes.status).toBe(401);
    expect(listRes.headers["set-cookie"]?.[0]).toContain("token=;");

    const getRes = await request(app)
      .get("/favorites/550")
      .set("Cookie", [cookieHeader!]);
    expect(getRes.status).toBe(401);
    expect(getRes.headers["set-cookie"]?.[0]).toContain("token=;");

    const delRes = await request(app)
      .delete("/favorites/550")
      .set("Cookie", [cookieHeader!]);
    expect(delRes.status).toBe(401);
    expect(delRes.headers["set-cookie"]?.[0]).toContain("token=;");
  });

  test("POST /logout clears the cookie and revokes the previous JWT via tokenVersion", async () => {
    const registerRes = await request(app)
      .post("/register")
      .send(VALID_CREDENTIALS);
    const capturedCookie = registerRes.headers["set-cookie"]?.[0]?.split(";")[0];
    expect(capturedCookie).toBeDefined();

    const logoutRes = await request(app)
      .post("/logout")
      .set("Cookie", [capturedCookie!]);
    expect(logoutRes.status).toBe(204);
    expect(logoutRes.headers["set-cookie"]?.[0]).toContain("token=;");

    // Replaying the captured pre-logout JWT must be rejected server-side
    const replayMe = await request(app)
      .get("/me")
      .set("Cookie", [capturedCookie!]);
    expect(replayMe.status).toBe(401);
    expect(replayMe.headers["set-cookie"]?.[0]).toContain("token=;");

    const replayFavs = await request(app)
      .get("/favorites")
      .set("Cookie", [capturedCookie!]);
    expect(replayFavs.status).toBe(401);

    // Logging in again issues a fresh tokenVersion; replaying the stale token
    // against POST /logout must not invalidate the newer active session.
    const reloginRes = await request(app)
      .post("/login")
      .send(VALID_CREDENTIALS);
    expect(reloginRes.status).toBe(200);
    const freshCookie = reloginRes.headers["set-cookie"]?.[0]?.split(";")[0];
    expect(freshCookie).toBeDefined();

    const staleLogout = await request(app)
      .post("/logout")
      .set("Cookie", [capturedCookie!]);
    expect(staleLogout.status).toBe(204);

    const freshMe = await request(app)
      .get("/me")
      .set("Cookie", [freshCookie!]);
    expect(freshMe.status).toBe(200);
  });
});
