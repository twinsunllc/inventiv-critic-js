import { describe, it, expect } from "vitest";
import { CriticClient, DEFAULT_HOST, CriticError, AuthError, Critic } from "../index.js";

describe("barrel exports", () => {
  it("exports CriticClient", () => {
    expect(CriticClient).toBeDefined();
  });

  it("exports DEFAULT_HOST pointing to production", () => {
    expect(DEFAULT_HOST).toBe("https://critic.inventiv.io");
  });

  it("exports CriticError and AuthError", () => {
    expect(CriticError).toBeDefined();
    expect(AuthError).toBeDefined();
    expect(new AuthError("test", 401)).toBeInstanceOf(CriticError);
  });

  it("exports Critic legacy convenience object", () => {
    expect(Critic).toBeDefined();
    expect(Critic.Report).toBeDefined();
    expect(typeof Critic.Report.create).toBe("function");
  });
});
