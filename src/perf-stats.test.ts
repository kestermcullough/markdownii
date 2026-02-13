import { describe, expect, it } from "vitest";
import {
  METRIC_APP_OPEN,
  METRIC_EDITOR_RENDER,
  METRIC_VAULT_FS_DELTA_REFRESH,
  METRIC_VAULT_OPEN_TOTAL,
  METRIC_VAULT_TREE_SCAN,
  PerfStats,
} from "./perf-stats";

describe("PerfStats", () => {
  it("records durations and exposes latest summary", () => {
    const perf = new PerfStats("test.perf.summary");

    perf.recordDuration(METRIC_APP_OPEN, 120.234);
    perf.recordDuration(METRIC_VAULT_OPEN_TOTAL, 340.56);
    perf.recordDuration(METRIC_VAULT_TREE_SCAN, 212.45, {
      markdownFiles: 40,
      directories: 9,
      ignored: null,
    });

    perf.recordDuration(METRIC_VAULT_FS_DELTA_REFRESH, 30.1, {
      fullRefresh: true,
    });
    perf.recordDuration(METRIC_VAULT_FS_DELTA_REFRESH, 18.4, {
      fallbackRefresh: true,
    });
    perf.recordDuration(METRIC_EDITOR_RENDER, 1.1);
    perf.recordDuration(METRIC_EDITOR_RENDER, 2.2);
    perf.recordDuration(METRIC_EDITOR_RENDER, 3.3);
    perf.recordDuration(METRIC_EDITOR_RENDER, 4.4);
    perf.recordDuration(METRIC_EDITOR_RENDER, 9.9);

    const summary = perf.summary();
    expect(summary.appOpenMs).toBe(120.23);
    expect(summary.vaultOpenMs).toBe(340.56);
    expect(summary.vaultTreeScanMs).toBe(212.45);
    expect(summary.crashCount).toBe(0);
    expect(summary.vaultFsDeltaMs).toBe(18.4);
    expect(summary.vaultFsFullRefreshes).toBe(1);
    expect(summary.vaultFsFallbackRefreshes).toBe(1);
    expect(summary.editorRenderP50Ms).toBe(3.3);
    expect(summary.editorRenderP95Ms).toBe(9.9);
  });

  it("supports start/stop timer closures", () => {
    const perf = new PerfStats("test.perf.timer");
    const stop = perf.startTimer(METRIC_VAULT_OPEN_TOTAL, { source: "dialog" });
    const sample = stop({ markdownFiles: 12 });

    expect(sample.name).toBe(METRIC_VAULT_OPEN_TOTAL);
    expect(sample.durationMs).toBeGreaterThanOrEqual(0);
    expect(sample.context).toMatchObject({ source: "dialog", markdownFiles: 12 });
  });

  it("records crashes and keeps last crash details", () => {
    const perf = new PerfStats("test.perf.crashes");
    perf.recordCrash("window.error", new Error("boom"));
    perf.recordCrash("window.unhandledrejection", "late rejection");

    const summary = perf.summary();
    expect(summary.crashCount).toBe(2);
    expect(summary.lastCrash?.source).toBe("window.unhandledrejection");
    expect(summary.lastCrash?.message).toBe("late rejection");
  });
});
