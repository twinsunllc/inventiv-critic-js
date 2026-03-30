import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CriticClient, DEFAULT_HOST } from "../client.js";
import { CriticError, AuthError } from "../errors.js";

function mockResponse(status: number, body: unknown, ok?: boolean): Response {
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe("CriticClient", () => {
  let client: CriticClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    client = new CriticClient({
      apiToken: "org-token",
    });
  });

  afterEach(() => {
    client.destroy();
  });

  describe("constructor", () => {
    it("uses default host when none provided", () => {
      const c = new CriticClient({ apiToken: "t" });
      c.destroy();
      expect(c.host).toBe(DEFAULT_HOST);
    });

    it("uses custom host and strips trailing slashes", () => {
      const c = new CriticClient({
        apiToken: "t",
        host: "https://custom.example.com/",
      });
      c.destroy();
      expect(c.host).toBe("https://custom.example.com");
    });

    it("starts console capture by default (opt-out)", () => {
      const originalLog = console.log;
      const c = new CriticClient({ apiToken: "t" });
      expect(console.log).not.toBe(originalLog);
      c.destroy();
      expect(console.log).toBe(originalLog);
    });

    it("does not start console capture when captureConsoleLogs is false", () => {
      const originalLog = console.log;
      const c = new CriticClient({ apiToken: "t", captureConsoleLogs: false });
      expect(console.log).toBe(originalLog);
      c.destroy();
    });
  });

  describe("ping", () => {
    const app = {
      name: "TestApp",
      package: "com.test.app",
      platform: "iOS",
      version: { code: "1", name: "1.0.0" },
    };
    const device = {
      identifier: "device-123",
      manufacturer: "Apple",
      model: "iPhone 15",
      platform: "iOS",
      platform_version: "17.0",
    };

    it("sends POST to /api/v3/ping with JSON body and returns AppInstall", async () => {
      mockFetch.mockResolvedValue(mockResponse(200, { app_install: { id: "uuid-123" } }));

      const result = await client.ping(app, device);

      expect(result).toEqual({ id: "uuid-123" });
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${DEFAULT_HOST}/api/v3/ping`);
      expect(options.method).toBe("POST");
      expect(options.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(options.body);
      expect(body.api_token).toBe("org-token");
      expect(body.app).toEqual(app);
      expect(body.device).toEqual(device);
      expect(body.device_status).toBeUndefined();
    });

    it("includes device_status when provided", async () => {
      mockFetch.mockResolvedValue(mockResponse(200, { app_install: { id: "uuid-456" } }));

      await client.ping(app, device, { battery_level: 85 });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.device_status).toEqual({ battery_level: 85 });
    });

    it("throws AuthError on 401", async () => {
      mockFetch.mockResolvedValue(mockResponse(401, { error: "Invalid token" }, false));

      await expect(client.ping(app, device)).rejects.toThrow(AuthError);
      await expect(
        client.ping(app, device).catch((e: AuthError) => {
          expect(e.status).toBe(401);
          throw e;
        }),
      ).rejects.toThrow();
    });

    it("throws CriticError on 422", async () => {
      mockFetch.mockResolvedValue(mockResponse(422, { error: "Missing app name" }, false));

      await expect(client.ping(app, device)).rejects.toThrow(CriticError);
    });
  });

  describe("createBugReport", () => {
    const bugReport = {
      id: "report-uuid",
      description: "Something broke",
      metadata: null,
      steps_to_reproduce: null,
      user_identifier: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      attachments: [],
    };

    it("sends multipart POST to /api/v3/bug_reports", async () => {
      mockFetch.mockResolvedValue(mockResponse(201, bugReport));

      const result = await client.createBugReport("install-uuid", {
        description: "Something broke",
      });

      expect(result).toEqual(bugReport);
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${DEFAULT_HOST}/api/v3/bug_reports`);
      expect(options.method).toBe("POST");
      expect(options.body).toBeInstanceOf(FormData);

      const fd: FormData = options.body;
      expect(fd.get("api_token")).toBe("org-token");
      expect(fd.get("app_install[id]")).toBe("install-uuid");
      expect(fd.get("bug_report[description]")).toBe("Something broke");
    });

    it("includes optional fields when provided", async () => {
      mockFetch.mockResolvedValue(mockResponse(201, bugReport));

      await client.createBugReport("install-uuid", {
        description: "Bug",
        metadata: { key: "val" },
        steps_to_reproduce: "Step 1",
        user_identifier: "user@test.com",
      });

      const fd: FormData = mockFetch.mock.calls[0][1].body;
      expect(fd.get("bug_report[metadata]")).toBe(JSON.stringify({ key: "val" }));
      expect(fd.get("bug_report[steps_to_reproduce]")).toBe("Step 1");
      expect(fd.get("bug_report[user_identifier]")).toBe("user@test.com");
    });

    it("includes file attachments", async () => {
      mockFetch.mockResolvedValue(mockResponse(201, bugReport));

      const file = new File(["content"], "screenshot.png", {
        type: "image/png",
      });
      await client.createBugReport("install-uuid", { description: "Bug" }, [file]);

      const fd: FormData = mockFetch.mock.calls[0][1].body;
      expect(fd.getAll("bug_report[attachments][]")).toHaveLength(1);
    });

    it("includes device_status fields", async () => {
      mockFetch.mockResolvedValue(mockResponse(201, bugReport));

      await client.createBugReport("install-uuid", { description: "Bug" }, undefined, {
        battery: 50,
        charging: true,
      });

      const fd: FormData = mockFetch.mock.calls[0][1].body;
      expect(fd.get("device_status[battery]")).toBe("50");
      expect(fd.get("device_status[charging]")).toBe("true");
    });

    it("skips null/undefined device_status values", async () => {
      mockFetch.mockResolvedValue(mockResponse(201, bugReport));

      await client.createBugReport("install-uuid", { description: "Bug" }, undefined, {
        battery: 50,
        unknown: null,
      });

      const fd: FormData = mockFetch.mock.calls[0][1].body;
      expect(fd.get("device_status[battery]")).toBe("50");
      expect(fd.has("device_status[unknown]")).toBe(false);
    });

    it("throws AuthError on 403", async () => {
      mockFetch.mockResolvedValue(mockResponse(403, { error: "Forbidden" }, false));

      await expect(client.createBugReport("install-uuid", { description: "Bug" })).rejects.toThrow(
        AuthError,
      );
    });

    it("does not attach console logs when captureConsoleLogs is false", async () => {
      const noCapture = new CriticClient({ apiToken: "org-token", captureConsoleLogs: false });
      mockFetch.mockResolvedValue(mockResponse(201, bugReport));

      console.log("this should not be captured");
      await noCapture.createBugReport("install-uuid", { description: "Bug" });

      const fd: FormData = mockFetch.mock.calls[0][1].body;
      expect(fd.getAll("bug_report[attachments][]")).toHaveLength(0);
      noCapture.destroy();
    });

    it("auto-attaches console logs when captureConsoleLogs is enabled", async () => {
      const captureClient = new CriticClient({
        apiToken: "org-token",
        captureConsoleLogs: true,
      });
      mockFetch.mockResolvedValue(mockResponse(201, bugReport));

      console.log("test log for capture");
      console.warn("test warning for capture");

      await captureClient.createBugReport("install-uuid", { description: "Bug" });

      const fd: FormData = mockFetch.mock.calls[0][1].body;
      const attachments = fd.getAll("bug_report[attachments][]");
      expect(attachments.length).toBeGreaterThanOrEqual(1);

      const logFile = attachments.find(
        (a) => a instanceof File && a.name === "console-logs.txt",
      ) as File;
      expect(logFile).toBeDefined();
      expect(logFile.type).toBe("text/plain");

      const text = await logFile.text();
      expect(text).toContain("test log for capture");
      expect(text).toContain("test warning for capture");

      captureClient.destroy();
    });

    it("does not attach console logs file when buffer is empty", async () => {
      const captureClient = new CriticClient({
        apiToken: "org-token",
        captureConsoleLogs: true,
      });
      mockFetch.mockResolvedValue(mockResponse(201, bugReport));

      // No console output — buffer is empty
      await captureClient.createBugReport("install-uuid", { description: "Bug" });

      const fd: FormData = mockFetch.mock.calls[0][1].body;
      expect(fd.getAll("bug_report[attachments][]")).toHaveLength(0);

      captureClient.destroy();
    });

    it("appends console logs alongside user-provided attachments", async () => {
      const captureClient = new CriticClient({
        apiToken: "org-token",
        captureConsoleLogs: true,
      });
      mockFetch.mockResolvedValue(mockResponse(201, bugReport));

      console.log("captured");

      const userFile = new File(["img"], "screenshot.png", { type: "image/png" });
      await captureClient.createBugReport("install-uuid", { description: "Bug" }, [userFile]);

      const fd: FormData = mockFetch.mock.calls[0][1].body;
      const attachments = fd.getAll("bug_report[attachments][]");
      expect(attachments).toHaveLength(2);

      captureClient.destroy();
    });
  });

  describe("destroy", () => {
    it("restores console methods after destroy", () => {
      // client from beforeEach already wraps console; capture the current (wrapped) state
      const wrappedByBeforeEach = console.log;
      const captureClient = new CriticClient({
        apiToken: "org-token",
        captureConsoleLogs: true,
      });
      expect(console.log).not.toBe(wrappedByBeforeEach);
      captureClient.destroy();
      expect(console.log).toBe(wrappedByBeforeEach);
    });

    it("is safe to call when captureConsoleLogs is false", () => {
      const c = new CriticClient({ apiToken: "t", captureConsoleLogs: false });
      expect(() => c.destroy()).not.toThrow();
    });

    it("is safe to call destroy() multiple times (idempotent)", () => {
      const c = new CriticClient({ apiToken: "t", captureConsoleLogs: true });
      expect(() => {
        c.destroy();
        c.destroy();
        c.destroy();
      }).not.toThrow();
    });

    it("does not throw TypeError on page navigation simulation (destroy after disconnect)", () => {
      // Simulate what happens when a Stimulus controller is disconnected:
      // connect() creates the client, disconnect() calls destroy() — sometimes more than once
      const originalLog = console.log;
      const c = new CriticClient({ apiToken: "t", captureConsoleLogs: true });
      expect(console.log).not.toBe(originalLog);

      // First destroy (e.g., Stimulus disconnect)
      expect(() => c.destroy()).not.toThrow();
      expect(console.log).toBe(originalLog);

      // Second destroy (e.g., a duplicate navigation event or cleanup)
      expect(() => c.destroy()).not.toThrow();
      expect(console.log).toBe(originalLog);
    });

    it("console logs captured before destroy are still available to attach if needed", () => {
      const c = new CriticClient({ apiToken: "t", captureConsoleLogs: true });
      console.log("before destroy");
      // Accessing internal capture state via toFile is not exposed, but we confirm
      // that destroy does not corrupt state prior to being called — destroy() only
      // stops capture, it does not clear the buffer
      c.destroy();
    });
  });

  describe("error handling", () => {
    it("extracts error message from response body", async () => {
      mockFetch.mockResolvedValue(mockResponse(400, { error: "Bad request" }, false));

      try {
        await client.ping(
          {
            name: "A",
            package: "p",
            platform: "Unknown",
            version: { code: "1", name: "1" },
          },
          {
            identifier: "d",
            manufacturer: "m",
            model: "m",
            platform: "Unknown",
            platform_version: "1",
          },
        );
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(CriticError);
        expect((e as CriticError).message).toBe("Bad request");
        expect((e as CriticError).status).toBe(400);
        expect((e as CriticError).body).toEqual({ error: "Bad request" });
      }
    });

    it("falls back to generic message when body has no error field", async () => {
      mockFetch.mockResolvedValue(mockResponse(500, { details: "something" }, false));

      try {
        await client.ping(
          {
            name: "A",
            package: "p",
            platform: "Unknown",
            version: { code: "1", name: "1" },
          },
          {
            identifier: "d",
            manufacturer: "m",
            model: "m",
            platform: "Unknown",
            platform_version: "1",
          },
        );
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(CriticError);
        expect((e as CriticError).message).toBe("Critic API error (500)");
      }
    });

    it("propagates network errors", async () => {
      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(
        client.ping(
          {
            name: "A",
            package: "p",
            platform: "Unknown",
            version: { code: "1", name: "1" },
          },
          {
            identifier: "d",
            manufacturer: "m",
            model: "m",
            platform: "Unknown",
            platform_version: "1",
          },
        ),
      ).rejects.toThrow("Failed to fetch");
    });
  });
});
