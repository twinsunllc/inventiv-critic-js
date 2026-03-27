import { describe, it, expect } from "vitest";
import { CriticError, AuthError } from "../errors.js";

describe("CriticError", () => {
  it("stores message, status, and body", () => {
    const error = new CriticError("Something failed", 422, { detail: "x" });
    expect(error.message).toBe("Something failed");
    expect(error.status).toBe(422);
    expect(error.body).toEqual({ detail: "x" });
    expect(error.name).toBe("CriticError");
  });

  it("is an instance of Error", () => {
    const error = new CriticError("fail", 500);
    expect(error).toBeInstanceOf(Error);
  });

  it("defaults body to undefined", () => {
    const error = new CriticError("fail", 400);
    expect(error.body).toBeUndefined();
  });
});

describe("AuthError", () => {
  it("extends CriticError", () => {
    const error = new AuthError("Unauthorized", 401);
    expect(error).toBeInstanceOf(CriticError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AuthError");
  });

  it("stores status and body", () => {
    const error = new AuthError("Forbidden", 403, { error: "no access" });
    expect(error.status).toBe(403);
    expect(error.body).toEqual({ error: "no access" });
  });
});
