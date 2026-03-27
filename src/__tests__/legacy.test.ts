import { describe, it, expect, vi, beforeEach } from "vitest";
import { Critic } from "../legacy.js";
import { DEFAULT_HOST } from "../client.js";

describe("Critic.Report.create (legacy API)", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  const bugReport = {
    id: "report-uuid",
    description: "Bug",
    metadata: null,
    steps_to_reproduce: null,
    user_identifier: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    attachments: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: vi.fn().mockResolvedValue(bugReport),
      text: vi.fn().mockResolvedValue(JSON.stringify(bugReport)),
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  it("sends a bug report using the convenience API", async () => {
    const result = await Critic.Report.create({
      apiToken: "org-token",
      appInstallId: "install-uuid",
      description: "Something broke",
    });

    expect(result).toEqual(bugReport);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${DEFAULT_HOST}/api/v3/bug_reports`);
    expect(options.method).toBe("POST");
  });

  it("uses custom host when provided", async () => {
    await Critic.Report.create({
      host: "https://custom.example.com",
      apiToken: "org-token",
      appInstallId: "install-uuid",
      description: "Bug",
    });

    const url: string = mockFetch.mock.calls[0][0];
    expect(url.startsWith("https://custom.example.com")).toBe(true);
  });

  it("calls success callback on success", async () => {
    const success = vi.fn();
    const failure = vi.fn();

    await Critic.Report.create({
      apiToken: "org-token",
      appInstallId: "install-uuid",
      description: "Bug",
      success,
      failure,
    });

    // Wait for microtask to resolve the then()
    await new Promise((r) => setTimeout(r, 0));

    expect(success).toHaveBeenCalledWith(bugReport);
    expect(failure).not.toHaveBeenCalled();
  });

  it("calls failure callback on error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ error: "Unauthorized" }),
      text: vi.fn().mockResolvedValue('{"error":"Unauthorized"}'),
    });

    const success = vi.fn();
    const failure = vi.fn();

    Critic.Report.create({
      apiToken: "bad-token",
      appInstallId: "install-uuid",
      description: "Bug",
      success,
      failure,
    });

    // Wait for the promise chain to settle
    await new Promise((r) => setTimeout(r, 50));

    expect(success).not.toHaveBeenCalled();
    expect(failure).toHaveBeenCalled();
  });

  it("includes optional fields in the form data", async () => {
    await Critic.Report.create({
      apiToken: "org-token",
      appInstallId: "install-uuid",
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

  it("defaults to Critic.host", () => {
    expect(Critic.host).toBe(DEFAULT_HOST);
  });
});
