import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConsoleLogCapture } from "../console-capture.js";

describe("ConsoleLogCapture", () => {
  let capture: ConsoleLogCapture;
  const originals = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };

  beforeEach(() => {
    capture = new ConsoleLogCapture();
  });

  afterEach(() => {
    capture.stop();
    // Restore originals in case a test left things in a bad state
    console.log = originals.log;
    console.warn = originals.warn;
    console.error = originals.error;
    console.info = originals.info;
    console.debug = originals.debug;
  });

  describe("start/stop", () => {
    it("wraps console methods on start and restores on stop", () => {
      const originalLog = console.log;
      capture.start();
      expect(console.log).not.toBe(originalLog);

      capture.stop();
      expect(console.log).toBe(originalLog);
    });

    it("is a no-op if start is called twice", () => {
      capture.start();
      const wrappedLog = console.log;
      capture.start();
      expect(console.log).toBe(wrappedLog);
    });

    it("is a no-op if stop is called without start", () => {
      const originalLog = console.log;
      capture.stop();
      expect(console.log).toBe(originalLog);
    });
  });

  describe("capturing", () => {
    it("captures console.log messages", () => {
      capture.start();
      console.log("hello", "world");
      const entries = capture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe("log");
      expect(entries[0].message).toBe("hello world");
      expect(entries[0].timestamp).toBeTypeOf("number");
    });

    it("captures all console methods", () => {
      capture.start();
      console.log("log msg");
      console.warn("warn msg");
      console.error("error msg");
      console.info("info msg");
      console.debug("debug msg");

      const entries = capture.getEntries();
      expect(entries).toHaveLength(5);
      expect(entries.map((e) => e.level)).toEqual(["log", "warn", "error", "info", "debug"]);
    });

    it("preserves original console output", () => {
      const spy = vi.fn();
      const originalLog = console.log;
      console.log = spy;

      const cap = new ConsoleLogCapture();
      cap.start();
      console.log("test");
      expect(spy).toHaveBeenCalledWith("test");

      cap.stop();
      console.log = originalLog;
    });

    it("stringifies objects as JSON", () => {
      capture.start();
      console.log({ key: "value" });
      expect(capture.getEntries()[0].message).toBe('{"key":"value"}');
    });

    it("stringifies Error objects with name and message", () => {
      capture.start();
      console.error(new TypeError("bad type"));
      expect(capture.getEntries()[0].message).toBe("TypeError: bad type");
    });

    it("handles circular references gracefully", () => {
      capture.start();
      const obj: Record<string, unknown> = {};
      obj.self = obj;
      console.log(obj);
      // Falls back to String()
      expect(capture.getEntries()[0].message).toBe("[object Object]");
    });
  });

  describe("ring buffer", () => {
    it("limits entries to maxEntries", () => {
      const cap = new ConsoleLogCapture(3);
      cap.start();
      console.log("a");
      console.log("b");
      console.log("c");
      console.log("d");

      const entries = cap.getEntries();
      expect(entries).toHaveLength(3);
      expect(entries[0].message).toBe("b");
      expect(entries[2].message).toBe("d");
      cap.stop();
    });

    it("defaults to 500 entries", () => {
      capture.start();
      for (let i = 0; i < 600; i++) {
        console.log(`msg-${i}`);
      }
      expect(capture.getEntries()).toHaveLength(500);
      // Oldest should be msg-100, newest msg-599
      expect(capture.getEntries()[0].message).toBe("msg-100");
      expect(capture.getEntries()[499].message).toBe("msg-599");
    });
  });

  describe("clear", () => {
    it("empties the buffer", () => {
      capture.start();
      console.log("msg");
      expect(capture.getEntries()).toHaveLength(1);
      capture.clear();
      expect(capture.getEntries()).toHaveLength(0);
    });

    it("continues capturing after clear", () => {
      capture.start();
      console.log("before");
      capture.clear();
      console.log("after");
      expect(capture.getEntries()).toHaveLength(1);
      expect(capture.getEntries()[0].message).toBe("after");
    });
  });

  describe("getEntries", () => {
    it("returns a copy, not a reference", () => {
      capture.start();
      console.log("msg");
      const entries = capture.getEntries();
      entries.pop();
      expect(capture.getEntries()).toHaveLength(1);
    });
  });

  describe("serialize", () => {
    it("formats entries as timestamped lines", () => {
      vi.spyOn(Date, "now").mockReturnValue(1711612800000); // 2024-03-28T12:00:00Z
      capture.start();
      console.log("hello");
      console.warn("warning");

      const text = capture.serialize();
      const lines = text.split("\n");
      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatch(/^\[.*\] LOG: hello$/);
      expect(lines[1]).toMatch(/^\[.*\] WARN: warning$/);
    });

    it("returns empty string when buffer is empty", () => {
      expect(capture.serialize()).toBe("");
    });
  });

  describe("toFile", () => {
    it("returns null when buffer is empty", () => {
      expect(capture.toFile()).toBeNull();
    });

    it("returns a File with correct name and type", () => {
      capture.start();
      console.log("msg");
      const file = capture.toFile();
      expect(file).toBeInstanceOf(File);
      expect(file!.name).toBe("console-logs.txt");
      expect(file!.type).toBe("text/plain");
    });

    it("file content matches serialized output", async () => {
      capture.start();
      console.log("test-msg");
      const file = capture.toFile()!;
      const text = await file.text();
      expect(text).toBe(capture.serialize());
    });
  });
});
