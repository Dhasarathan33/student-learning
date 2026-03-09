import request from "supertest";
import app from "../src/app.js";

describe("App smoke tests", () => {
  it("returns health text on root route", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toBe("API is running");
  });

  it("returns 401 for protected route without token", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Missing token");
  });

  it("returns structured 404 response for unknown route", async () => {
    const res = await request(app).get("/api/not-found");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Route not found");
    expect(res.body.path).toBe("/api/not-found");
    expect(typeof res.body.request_id).toBe("string");
  });
});
