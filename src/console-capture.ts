/** Severity levels corresponding to console methods. */
export type ConsoleLogLevel = "log" | "warn" | "error" | "info" | "debug";

/** A single captured console log entry. */
export interface ConsoleLogEntry {
  level: ConsoleLogLevel;
  message: string;
  timestamp: number;
}

const CONSOLE_METHODS: ConsoleLogLevel[] = ["log", "warn", "error", "info", "debug"];
const DEFAULT_MAX_ENTRIES = 500;

/**
 * Captures console output into a bounded ring buffer.
 *
 * Wraps the global `console` methods and, in browser environments,
 * also captures `window.onerror` and `window.onunhandledrejection` events.
 * Original behaviour is preserved — output still appears in DevTools / stdout.
 */
export class ConsoleLogCapture {
  private buffer: ConsoleLogEntry[];
  private readonly maxEntries: number;
  private readonly originals: Map<ConsoleLogLevel, (...args: unknown[]) => void> = new Map();
  private capturing = false;

  // Browser error event handlers (stored so we can remove them on destroy)
  private errorHandler: ((event: ErrorEvent) => void) | null = null;
  private rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

  constructor(maxEntries: number = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
    this.buffer = [];
  }

  /** Begin capturing console output. Safe to call multiple times (no-op if already capturing). */
  start(): void {
    if (this.capturing) return;
    this.capturing = true;

    for (const level of CONSOLE_METHODS) {
      const original = console[level];
      this.originals.set(level, original);

      console[level] = (...args: unknown[]) => {
        this.push(level, args);
        original.apply(console, args);
      };
    }

    this.attachGlobalErrorHandlers();
  }

  /** Stop capturing and restore original console methods. */
  stop(): void {
    if (!this.capturing) return;
    this.capturing = false;

    for (const [level, original] of this.originals) {
      console[level] = original;
    }
    this.originals.clear();

    this.detachGlobalErrorHandlers();
  }

  /** Return a snapshot of the current buffer (oldest first). */
  getEntries(): ConsoleLogEntry[] {
    return [...this.buffer];
  }

  /** Clear the buffer without stopping capture. */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Serialize the buffer as a human-readable text log suitable for attaching to a bug report.
   * Each line: `[ISO timestamp] LEVEL: message`
   */
  serialize(): string {
    return this.buffer
      .map((entry) => {
        const ts = new Date(entry.timestamp).toISOString();
        return `[${ts}] ${entry.level.toUpperCase()}: ${entry.message}`;
      })
      .join("\n");
  }

  /**
   * Create a `File` object from the serialized log suitable for form-data upload.
   * Returns `null` if the buffer is empty.
   */
  toFile(): File | null {
    if (this.buffer.length === 0) return null;
    const content = this.serialize();
    return new File([content], "console-logs.txt", { type: "text/plain" });
  }

  // ---- private ----

  private push(level: ConsoleLogLevel, args: unknown[]): void {
    const entry: ConsoleLogEntry = {
      level,
      message: args.map(stringifyArg).join(" "),
      timestamp: Date.now(),
    };

    if (this.buffer.length >= this.maxEntries) {
      this.buffer.shift();
    }
    this.buffer.push(entry);
  }

  private attachGlobalErrorHandlers(): void {
    if (typeof globalThis.addEventListener !== "function") return;

    this.errorHandler = (event: ErrorEvent) => {
      const message = event.message ?? String(event.error ?? "Unknown error");
      this.push("error", [
        `[window.onerror] ${message} at ${event.filename ?? "unknown"}:${event.lineno ?? 0}:${event.colno ?? 0}`,
      ]);
    };

    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error
          ? event.reason.message
          : String(event.reason ?? "Unknown rejection");
      this.push("error", [`[unhandledrejection] ${reason}`]);
    };

    globalThis.addEventListener("error", this.errorHandler as EventListener);
    globalThis.addEventListener("unhandledrejection", this.rejectionHandler as EventListener);
  }

  private detachGlobalErrorHandlers(): void {
    if (typeof globalThis.removeEventListener !== "function") return;

    if (this.errorHandler) {
      globalThis.removeEventListener("error", this.errorHandler as EventListener);
      this.errorHandler = null;
    }
    if (this.rejectionHandler) {
      globalThis.removeEventListener("unhandledrejection", this.rejectionHandler as EventListener);
      this.rejectionHandler = null;
    }
  }
}

function stringifyArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}
