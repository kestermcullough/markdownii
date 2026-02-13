export const METRIC_APP_OPEN = "app.open";
export const METRIC_FILE_OPEN = "file.open";
export const METRIC_VAULT_OPEN_TOTAL = "vault.open.total";
export const METRIC_VAULT_TREE_SCAN = "vault.open.treeScan";
export const METRIC_VAULT_FS_DELTA_REFRESH = "vault.fsDeltaRefresh";
export const METRIC_EDITOR_RENDER = "editor.render";

const PERF_STORAGE_KEY = "markdownii.perf.stats.v1";
const MAX_SAMPLES = 200;
const MAX_CRASHES = 40;

type PerfListener = () => void;
export type PerfContextValue = string | number | boolean;
export type PerfContext = Record<string, PerfContextValue>;

export interface PerfSample {
  name: string;
  durationMs: number;
  at: string;
  context?: PerfContext;
}

export interface CrashEntry {
  source: string;
  message: string;
  stack?: string;
  at: string;
}

interface PerfPersistenceShape {
  samples?: PerfSample[];
  crashes?: CrashEntry[];
}

export interface PerfSummary {
  appOpenMs: number | null;
  fileOpenMs: number | null;
  vaultOpenMs: number | null;
  vaultTreeScanMs: number | null;
  vaultFsDeltaMs: number | null;
  vaultFsFullRefreshes: number;
  vaultFsFallbackRefreshes: number;
  editorRenderP50Ms: number | null;
  editorRenderP95Ms: number | null;
  crashCount: number;
  lastCrash: CrashEntry | null;
}

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function roundMs(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return roundMs(sorted[rank]);
}

function readStorage(storageKey: string): PerfPersistenceShape | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as PerfPersistenceShape;
  } catch {
    return null;
  }
}

function writeStorage(storageKey: string, value: PerfPersistenceShape) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Best-effort persistence only.
  }
}

function sanitizeContext(context?: Record<string, unknown>): PerfContext | undefined {
  if (!context) return undefined;
  const result: PerfContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      result[key] = value;
    }
  }
  return Object.keys(result).length ? result : undefined;
}

function normalizeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  return { message: String(error) };
}

export class PerfStats {
  private samples: PerfSample[] = [];
  private crashes: CrashEntry[] = [];
  private listeners = new Set<PerfListener>();
  private globalHandlersInstalled = false;

  constructor(private storageKey: string = PERF_STORAGE_KEY) {
    const persisted = readStorage(storageKey);
    if (persisted?.samples) {
      this.samples = persisted.samples.slice(-MAX_SAMPLES);
    }
    if (persisted?.crashes) {
      this.crashes = persisted.crashes.slice(-MAX_CRASHES);
    }
  }

  onChange(listener: PerfListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  installGlobalHandlers() {
    if (this.globalHandlersInstalled || typeof window === "undefined") return;
    this.globalHandlersInstalled = true;

    window.addEventListener("error", (event) => {
      this.recordCrash("window.error", event.error ?? event.message);
    });

    window.addEventListener("unhandledrejection", (event) => {
      this.recordCrash("window.unhandledrejection", event.reason);
    });
  }

  startTimer(name: string, context?: PerfContext) {
    const start = nowMs();
    return (moreContext?: PerfContext) => {
      const mergedContext = {
        ...(context ?? {}),
        ...(moreContext ?? {}),
      };
      return this.recordDuration(name, nowMs() - start, mergedContext);
    };
  }

  recordDuration(
    name: string,
    durationMs: number,
    context?: Record<string, unknown>
  ): PerfSample {
    const sample: PerfSample = {
      name,
      durationMs: roundMs(durationMs),
      at: new Date().toISOString(),
      context: sanitizeContext(context),
    };

    this.samples.push(sample);
    if (this.samples.length > MAX_SAMPLES) {
      this.samples.splice(0, this.samples.length - MAX_SAMPLES);
    }

    this.persist();
    this.emit();
    return sample;
  }

  recordCrash(source: string, error: unknown): CrashEntry {
    const normalized = normalizeError(error);
    const entry: CrashEntry = {
      source,
      message: normalized.message,
      stack: normalized.stack,
      at: new Date().toISOString(),
    };

    this.crashes.push(entry);
    if (this.crashes.length > MAX_CRASHES) {
      this.crashes.splice(0, this.crashes.length - MAX_CRASHES);
    }

    this.persist();
    this.emit();
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error(`[markdownii] ${source}: ${entry.message}`, error);
    }
    return entry;
  }

  getLatest(name: string): PerfSample | null {
    for (let i = this.samples.length - 1; i >= 0; i--) {
      if (this.samples[i].name === name) {
        return this.samples[i];
      }
    }
    return null;
  }

  getSamples(name?: string): readonly PerfSample[] {
    if (!name) return this.samples;
    return this.samples.filter((sample) => sample.name === name);
  }

  getCrashes(): readonly CrashEntry[] {
    return this.crashes;
  }

  summary(): PerfSummary {
    const fsDeltaSamples = this.getSamples(METRIC_VAULT_FS_DELTA_REFRESH);
    const fullRefreshCount = fsDeltaSamples.filter(
      (sample) => sample.context?.fullRefresh === true
    ).length;
    const fallbackRefreshCount = fsDeltaSamples.filter(
      (sample) => sample.context?.fallbackRefresh === true
    ).length;
    const editorRenderDurations = this.getSamples(METRIC_EDITOR_RENDER).map(
      (sample) => sample.durationMs
    );
    return {
      appOpenMs: this.getLatest(METRIC_APP_OPEN)?.durationMs ?? null,
      fileOpenMs: this.getLatest(METRIC_FILE_OPEN)?.durationMs ?? null,
      vaultOpenMs: this.getLatest(METRIC_VAULT_OPEN_TOTAL)?.durationMs ?? null,
      vaultTreeScanMs: this.getLatest(METRIC_VAULT_TREE_SCAN)?.durationMs ?? null,
      vaultFsDeltaMs:
        this.getLatest(METRIC_VAULT_FS_DELTA_REFRESH)?.durationMs ?? null,
      vaultFsFullRefreshes: fullRefreshCount,
      vaultFsFallbackRefreshes: fallbackRefreshCount,
      editorRenderP50Ms: percentile(editorRenderDurations, 50),
      editorRenderP95Ms: percentile(editorRenderDurations, 95),
      crashCount: this.crashes.length,
      lastCrash: this.crashes.length ? this.crashes[this.crashes.length - 1] : null,
    };
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  private persist() {
    writeStorage(this.storageKey, {
      samples: this.samples,
      crashes: this.crashes,
    });
  }
}
