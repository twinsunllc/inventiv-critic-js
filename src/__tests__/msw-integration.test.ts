import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { CriticClient } from "../client.js";
import { CriticError, AuthError } from "../errors.js";

const TEST_HOST = "https://critic-test.example.com";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createClient(opts?: { appApiToken?: string }) {
  return new CriticClient({
    host: TEST_HOST,
    apiToken: "test-org-token",
    appApiToken: opts?.appApiToken ?? "test-app-token",
  });
}

describe("MSW integration: ping", () => {
  it("POST /api/v3/ping returns app install", async () => {
    server.use(
      http.post(`${TEST_HOST}/api/v3/ping`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.api_token).toBe("test-org-token");
        expect(body.app).toBeDefined();
        expect(body.device).toBeDefined();
        return HttpResponse.json({ app_install: { id: "install-abc" } });
      }),
    );

    const client = createClient();
    const result = await client.ping(
      { name: "App", package: "com.test", platform: "web", version: { code: "1", name: "1.0" } },
      {
        identifier: "dev-1",
        manufacturer: "Test",
        model: "Browser",
        platform: "web",
        platform_version: "1.0",
      },
    );

    expect(result).toEqual({ id: "install-abc" });
  });

  it("POST /api/v3/ping forwards device_status", async () => {
    server.use(
      http.post(`${TEST_HOST}/api/v3/ping`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.device_status).toEqual({ battery: 80 });
        return HttpResponse.json({ app_install: { id: "install-ds" } });
      }),
    );

    const client = createClient();
    const result = await client.ping(
      { name: "App", package: "com.test", platform: "web", version: { code: "1", name: "1.0" } },
      {
        identifier: "dev-1",
        manufacturer: "Test",
        model: "Browser",
        platform: "web",
        platform_version: "1.0",
      },
      { battery: 80 },
    );

    expect(result.id).toBe("install-ds");
  });

  it("throws AuthError on 401", async () => {
    server.use(
      http.post(`${TEST_HOST}/api/v3/ping`, () => {
        return HttpResponse.json({ error: "Invalid token" }, { status: 401 });
      }),
    );

    const client = createClient();
    await expect(
      client.ping(
        {
          name: "App",
          package: "com.test",
          platform: "web",
          version: { code: "1", name: "1.0" },
        },
        {
          identifier: "d",
          manufacturer: "m",
          model: "m",
          platform: "web",
          platform_version: "1",
        },
      ),
    ).rejects.toThrow(AuthError);
  });

  it("throws CriticError on 422", async () => {
    server.use(
      http.post(`${TEST_HOST}/api/v3/ping`, () => {
        return HttpResponse.json({ error: "Validation failed" }, { status: 422 });
      }),
    );

    const client = createClient();
    await expect(
      client.ping(
        {
          name: "App",
          package: "com.test",
          platform: "web",
          version: { code: "1", name: "1.0" },
        },
        {
          identifier: "d",
          manufacturer: "m",
          model: "m",
          platform: "web",
          platform_version: "1",
        },
      ),
    ).rejects.toThrow(CriticError);
  });
});

describe("MSW integration: createBugReport", () => {
  it("POST /api/v3/bug_reports sends multipart form data", async () => {
    server.use(
      http.post(`${TEST_HOST}/api/v3/bug_reports`, async ({ request }) => {
        const formData = await request.formData();
        expect(formData.get("api_token")).toBe("test-org-token");
        expect(formData.get("app_install[id]")).toBe("install-1");
        expect(formData.get("bug_report[description]")).toBe("Test bug");

        return HttpResponse.json(
          {
            id: "report-1",
            description: "Test bug",
            metadata: null,
            steps_to_reproduce: null,
            user_identifier: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            attachments: [],
          },
          { status: 201 },
        );
      }),
    );

    const client = createClient();
    const result = await client.createBugReport("install-1", { description: "Test bug" });

    expect(result.id).toBe("report-1");
    expect(result.description).toBe("Test bug");
  });

  it("sends optional fields (metadata, steps, user_identifier)", async () => {
    server.use(
      http.post(`${TEST_HOST}/api/v3/bug_reports`, async ({ request }) => {
        const formData = await request.formData();
        expect(formData.get("bug_report[metadata]")).toBe('{"rating":5}');
        expect(formData.get("bug_report[steps_to_reproduce]")).toBe("Step 1");
        expect(formData.get("bug_report[user_identifier]")).toBe("user@test.com");

        return HttpResponse.json(
          {
            id: "report-2",
            description: "Bug",
            metadata: { rating: 5 },
            steps_to_reproduce: "Step 1",
            user_identifier: "user@test.com",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            attachments: [],
          },
          { status: 201 },
        );
      }),
    );

    const client = createClient();
    const result = await client.createBugReport("install-1", {
      description: "Bug",
      metadata: { rating: 5 },
      steps_to_reproduce: "Step 1",
      user_identifier: "user@test.com",
    });

    expect(result.metadata).toEqual({ rating: 5 });
  });

  it("sends file attachments", async () => {
    server.use(
      http.post(`${TEST_HOST}/api/v3/bug_reports`, async ({ request }) => {
        const formData = await request.formData();
        const files = formData.getAll("bug_report[attachments][]");
        expect(files).toHaveLength(1);

        return HttpResponse.json(
          {
            id: "report-3",
            description: "Bug with file",
            metadata: null,
            steps_to_reproduce: null,
            user_identifier: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            attachments: [
              {
                id: "att-1",
                file_file_name: "screenshot.png",
                file_file_size: 1024,
                file_content_type: "image/png",
                file_updated_at: "2026-01-01T00:00:00Z",
                url: "https://example.com/screenshot.png",
              },
            ],
          },
          { status: 201 },
        );
      }),
    );

    const client = createClient();
    const file = new File(["fake-image-data"], "screenshot.png", { type: "image/png" });
    const result = await client.createBugReport("install-1", { description: "Bug with file" }, [
      file,
    ]);

    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].file_file_name).toBe("screenshot.png");
  });

  it("throws AuthError on 403", async () => {
    server.use(
      http.post(`${TEST_HOST}/api/v3/bug_reports`, () => {
        return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
      }),
    );

    const client = createClient();
    await expect(client.createBugReport("install-1", { description: "Bug" })).rejects.toThrow(
      AuthError,
    );
  });
});

describe("MSW integration: listBugReports", () => {
  it("GET /api/v3/bug_reports returns paginated results", async () => {
    server.use(
      http.get(`${TEST_HOST}/api/v3/bug_reports`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("app_api_token")).toBe("test-app-token");

        return HttpResponse.json({
          count: 2,
          current_page: 1,
          total_pages: 1,
          bug_reports: [
            { id: "r1", description: "Bug 1" },
            { id: "r2", description: "Bug 2" },
          ],
        });
      }),
    );

    const client = createClient();
    const result = await client.listBugReports();

    expect(result.count).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe("r1");
  });

  it("sends filter parameters", async () => {
    server.use(
      http.get(`${TEST_HOST}/api/v3/bug_reports`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("archived")).toBe("true");
        expect(url.searchParams.get("device_id")).toBe("dev-1");
        expect(url.searchParams.get("since")).toBe("2026-01-01T00:00:00Z");

        return HttpResponse.json({
          count: 0,
          current_page: 1,
          total_pages: 0,
          bug_reports: [],
        });
      }),
    );

    const client = createClient();
    await client.listBugReports({
      archived: true,
      device_id: "dev-1",
      since: "2026-01-01T00:00:00Z",
    });
  });

  it("throws CriticError on 500", async () => {
    server.use(
      http.get(`${TEST_HOST}/api/v3/bug_reports`, () => {
        return HttpResponse.json({ error: "Internal server error" }, { status: 500 });
      }),
    );

    const client = createClient();
    await expect(client.listBugReports()).rejects.toThrow(CriticError);
  });
});

describe("MSW integration: getBugReport", () => {
  it("GET /api/v3/bug_reports/:uuid returns a single report", async () => {
    server.use(
      http.get(`${TEST_HOST}/api/v3/bug_reports/uuid-abc`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("app_api_token")).toBe("test-app-token");

        return HttpResponse.json({
          id: "uuid-abc",
          description: "Specific bug",
          metadata: { key: "val" },
          steps_to_reproduce: null,
          user_identifier: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          attachments: [],
        });
      }),
    );

    const client = createClient();
    const result = await client.getBugReport("uuid-abc");

    expect(result.id).toBe("uuid-abc");
    expect(result.description).toBe("Specific bug");
  });

  it("throws CriticError on 404", async () => {
    server.use(
      http.get(`${TEST_HOST}/api/v3/bug_reports/nonexistent`, () => {
        return HttpResponse.json({ error: "Not found" }, { status: 404 });
      }),
    );

    const client = createClient();
    await expect(client.getBugReport("nonexistent")).rejects.toThrow(CriticError);
  });
});

describe("MSW integration: listDevices", () => {
  it("GET /api/v3/devices returns paginated devices", async () => {
    server.use(
      http.get(`${TEST_HOST}/api/v3/devices`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("app_api_token")).toBe("test-app-token");

        return HttpResponse.json({
          count: 1,
          current_page: 1,
          total_pages: 1,
          devices: [
            {
              id: "d1",
              identifier: "device-1",
              manufacturer: "Apple",
              model: "iPhone 15",
              platform: "ios",
              platform_version: "17.0",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
          ],
        });
      }),
    );

    const client = createClient();
    const result = await client.listDevices();

    expect(result.count).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].identifier).toBe("device-1");
  });

  it("throws CriticError on 500", async () => {
    server.use(
      http.get(`${TEST_HOST}/api/v3/devices`, () => {
        return HttpResponse.json({ error: "Server error" }, { status: 500 });
      }),
    );

    const client = createClient();
    await expect(client.listDevices()).rejects.toThrow(CriticError);
  });
});
