import { describe, it, expect, vi, beforeEach } from "vitest";
import { CriticClient, DEFAULT_HOST } from "../index.js";

describe("CriticClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("uses default host when no config provided", () => {
      const client = new CriticClient();
      expect(client.host).toBe(DEFAULT_HOST);
    });

    it("uses custom host when provided", () => {
      const client = new CriticClient({ host: "https://custom.example.com" });
      expect(client.host).toBe("https://custom.example.com");
    });
  });

  describe("createReport", () => {
    it("sends a POST request with form data", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
      });
      vi.stubGlobal("fetch", mockFetch);

      const client = new CriticClient();
      const result = await client.createReport({
        productAccessToken: "test-token",
        description: "Test feedback",
      });

      expect(result).toEqual({ ok: true, status: 201 });
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${DEFAULT_HOST}/api/v1/reports`);
      expect(options.method).toBe("POST");
      expect(options.body).toBeInstanceOf(FormData);
    });

    it("includes metadata as JSON string when provided", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 201 });
      vi.stubGlobal("fetch", mockFetch);

      const client = new CriticClient();
      await client.createReport({
        productAccessToken: "test-token",
        description: "Test",
        metadata: { browser: "Chrome", version: "120" },
      });

      const formData: FormData = mockFetch.mock.calls[0][1].body;
      expect(formData.get("report[metadata]")).toBe(
        JSON.stringify({ browser: "Chrome", version: "120" }),
      );
    });

    it("includes attachments when provided", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 201 });
      vi.stubGlobal("fetch", mockFetch);

      const file = new File(["content"], "screenshot.png", { type: "image/png" });
      const client = new CriticClient();
      await client.createReport({
        productAccessToken: "test-token",
        description: "Test",
        attachments: [file],
      });

      const formData: FormData = mockFetch.mock.calls[0][1].body;
      expect(formData.getAll("report[attachments][]")).toHaveLength(1);
    });

    it("returns ok false on server error", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      vi.stubGlobal("fetch", mockFetch);

      const client = new CriticClient();
      const result = await client.createReport({
        productAccessToken: "test-token",
        description: "Test",
      });

      expect(result).toEqual({ ok: false, status: 500 });
    });

    it("propagates network errors", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
      vi.stubGlobal("fetch", mockFetch);

      const client = new CriticClient();
      await expect(
        client.createReport({
          productAccessToken: "test-token",
          description: "Test",
        }),
      ).rejects.toThrow("Failed to fetch");
    });
  });
});

describe("DEFAULT_HOST", () => {
  it("points to the production Critic API", () => {
    expect(DEFAULT_HOST).toBe("https://critic.inventiv.io");
  });
});
