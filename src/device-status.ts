import type { DeviceStatus } from "./types.js";

interface BatteryManager {
  charging: boolean;
  level: number;
}

interface NetworkInformation {
  type?: string;
}

/**
 * Collect browser-available device status fields without requiring user permission.
 *
 * Gathers battery, network, and memory information using browser APIs where available.
 * In Node.js environments, uses the `os` module for memory information.
 * All APIs are feature-detected; unsupported fields are omitted rather than throwing.
 *
 * @returns A {@link DeviceStatus} object with whichever fields could be collected.
 */
export async function getDeviceStatus(): Promise<DeviceStatus> {
  const status: DeviceStatus = {};

  // Battery Status API (Chromium-only)
  if (typeof navigator !== "undefined" && "getBattery" in navigator) {
    try {
      const battery = await (
        navigator as Navigator & { getBattery(): Promise<BatteryManager> }
      ).getBattery();
      status.battery_charging = battery.charging;
      status.battery_level = battery.level * 100;
    } catch {
      // Battery API unavailable or rejected — skip gracefully
    }
  }

  // Network Information API (Chromium-only)
  if (typeof navigator !== "undefined" && "connection" in navigator) {
    try {
      const conn = (navigator as Navigator & { connection: NetworkInformation }).connection;
      if (conn != null && conn.type !== undefined) {
        status.network_wifi_connected = conn.type === "wifi";
        status.network_cell_connected = conn.type === "cellular";
      }
    } catch {
      // Network Information API unavailable — skip gracefully
    }
  }

  // Device Memory API (Chromium-only) — returns approximate RAM in GB; convert to bytes
  if (typeof navigator !== "undefined" && "deviceMemory" in navigator) {
    try {
      const memGb = (navigator as Navigator & { deviceMemory: number }).deviceMemory;
      if (typeof memGb === "number") {
        status.memory_total = memGb * 1024 * 1024 * 1024;
      }
    } catch {
      // deviceMemory unavailable — skip gracefully
    }
  }

  // Node.js: use os module for memory (overrides deviceMemory if both present)
  if (typeof window === "undefined" && typeof process !== "undefined" && process.versions?.node) {
    try {
      const os = await import("node:os");
      status.memory_total = os.totalmem();
      status.memory_free = os.freemem();
    } catch {
      // os module unavailable — skip gracefully
    }
  }

  return status;
}
