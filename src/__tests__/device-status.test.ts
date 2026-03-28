import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDeviceStatus } from "../device-status.js";

describe("getDeviceStatus", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Reset navigator stubs
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty object when no browser APIs are available", async () => {
    vi.stubGlobal("navigator", {});
    const status = await getDeviceStatus();
    expect(status).toEqual({});
  });

  describe("battery", () => {
    it("collects battery_charging and battery_level when Battery API is available", async () => {
      vi.stubGlobal("navigator", {
        getBattery: vi.fn().mockResolvedValue({ charging: true, level: 0.85 }),
      });

      const status = await getDeviceStatus();

      expect(status.battery_charging).toBe(true);
      expect(status.battery_level).toBe(85);
    });

    it("collects battery_level = 0 when level is 0", async () => {
      vi.stubGlobal("navigator", {
        getBattery: vi.fn().mockResolvedValue({ charging: false, level: 0 }),
      });

      const status = await getDeviceStatus();

      expect(status.battery_charging).toBe(false);
      expect(status.battery_level).toBe(0);
    });

    it("skips battery fields when getBattery() rejects", async () => {
      vi.stubGlobal("navigator", {
        getBattery: vi.fn().mockRejectedValue(new Error("Not supported")),
      });

      const status = await getDeviceStatus();

      expect(status.battery_charging).toBeUndefined();
      expect(status.battery_level).toBeUndefined();
    });

    it("skips battery fields when getBattery is not in navigator", async () => {
      vi.stubGlobal("navigator", { model: "TestDevice" });

      const status = await getDeviceStatus();

      expect(status.battery_charging).toBeUndefined();
      expect(status.battery_level).toBeUndefined();
    });
  });

  describe("network", () => {
    it("sets network_wifi_connected=true and network_cell_connected=false when type is wifi", async () => {
      vi.stubGlobal("navigator", {
        connection: { type: "wifi" },
      });

      const status = await getDeviceStatus();

      expect(status.network_wifi_connected).toBe(true);
      expect(status.network_cell_connected).toBe(false);
    });

    it("sets network_cell_connected=true and network_wifi_connected=false when type is cellular", async () => {
      vi.stubGlobal("navigator", {
        connection: { type: "cellular" },
      });

      const status = await getDeviceStatus();

      expect(status.network_wifi_connected).toBe(false);
      expect(status.network_cell_connected).toBe(true);
    });

    it("sets both to false when connection type is ethernet", async () => {
      vi.stubGlobal("navigator", {
        connection: { type: "ethernet" },
      });

      const status = await getDeviceStatus();

      expect(status.network_wifi_connected).toBe(false);
      expect(status.network_cell_connected).toBe(false);
    });

    it("skips network fields when connection.type is undefined", async () => {
      vi.stubGlobal("navigator", {
        connection: {},
      });

      const status = await getDeviceStatus();

      expect(status.network_wifi_connected).toBeUndefined();
      expect(status.network_cell_connected).toBeUndefined();
    });

    it("skips network fields when connection is not in navigator", async () => {
      vi.stubGlobal("navigator", { model: "TestDevice" });

      const status = await getDeviceStatus();

      expect(status.network_wifi_connected).toBeUndefined();
      expect(status.network_cell_connected).toBeUndefined();
    });
  });

  describe("memory (browser)", () => {
    it("converts deviceMemory GB to bytes", async () => {
      vi.stubGlobal("navigator", {
        deviceMemory: 4,
      });

      const status = await getDeviceStatus();

      expect(status.memory_total).toBe(4 * 1024 * 1024 * 1024);
    });

    it("skips memory_total when deviceMemory is not in navigator", async () => {
      vi.stubGlobal("navigator", { model: "TestDevice" });

      const status = await getDeviceStatus();

      expect(status.memory_total).toBeUndefined();
    });
  });

  describe("combined fields", () => {
    it("collects all fields when all browser APIs are available", async () => {
      vi.stubGlobal("navigator", {
        getBattery: vi.fn().mockResolvedValue({ charging: false, level: 0.5 }),
        connection: { type: "wifi" },
        deviceMemory: 8,
      });

      const status = await getDeviceStatus();

      expect(status.battery_charging).toBe(false);
      expect(status.battery_level).toBe(50);
      expect(status.network_wifi_connected).toBe(true);
      expect(status.network_cell_connected).toBe(false);
      expect(status.memory_total).toBe(8 * 1024 * 1024 * 1024);
    });

    it("returns partial results when some APIs are unavailable", async () => {
      vi.stubGlobal("navigator", {
        getBattery: vi.fn().mockRejectedValue(new Error("Not supported")),
        connection: { type: "cellular" },
        // no deviceMemory
      });

      const status = await getDeviceStatus();

      expect(status.battery_charging).toBeUndefined();
      expect(status.battery_level).toBeUndefined();
      expect(status.network_wifi_connected).toBe(false);
      expect(status.network_cell_connected).toBe(true);
      expect(status.memory_total).toBeUndefined();
    });
  });
});
