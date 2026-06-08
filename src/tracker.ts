/**
 * Save-hook maintenance: a change tracker + debounced rebuild.
 *
 * Mirrors the Laravel ScoltaObserver / Django signals pattern without assuming
 * a queue: `touch(key)` records a change and schedules a debounced rebuild that
 * reuses the token cache (so only changed pages re-tokenize). Gated on the
 * `autoRebuild` config flag.
 *
 * In-process debounce is best-effort. Serverless deployments (Vercel/Netlify/
 * Lambda) should trigger rebuilds via webhook/CI instead — there is no shared
 * in-process timer across function invocations. Bulk writes that bypass the
 * save hooks need a manual `npx scolta-build` (same caveat as Laravel/Django).
 */

import type { NextScoltaConfig } from "./config.js";

export interface TrackerOptions {
  /** Run the rebuild. Should reuse the token cache (BuildIntent.fresh, no force). */
  rebuild: () => Promise<void> | void;
  logger?: { info(m: string, ...a: unknown[]): void; error(m: string, ...a: unknown[]): void };
}

export class ScoltaTracker {
  private readonly touched = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly config: NextScoltaConfig,
    private readonly opts: TrackerOptions,
  ) {}

  /** Record a changed entity and schedule a debounced rebuild. */
  touch(key: string): void {
    this.touched.add(key);
    this.schedule();
  }

  pending(): string[] {
    return [...this.touched];
  }

  clear(): void {
    this.touched.clear();
  }

  /** True if a rebuild is currently scheduled (pending the debounce window). */
  isScheduled(): boolean {
    return this.timer !== null;
  }

  private schedule(): void {
    if (!this.config.autoRebuild) return;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.runRebuild(), this.config.autoRebuildDelay);
    // Don't keep the event loop alive for a background rebuild.
    (this.timer as { unref?: () => void }).unref?.();
  }

  /** Run the rebuild immediately (used by tests and by an explicit flush). */
  async flushNow(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.runRebuild();
  }

  private async runRebuild(): Promise<void> {
    this.timer = null;
    this.touched.clear();
    try {
      await this.opts.rebuild();
    } catch (err) {
      this.opts.logger?.error("[scolta] Rebuild failed:", err);
    }
  }
}
