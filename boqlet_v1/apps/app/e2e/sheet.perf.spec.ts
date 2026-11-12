import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { apiAs, generatedDuplexBoq, signInAs } from "./helpers";

/**
 * F06-AC11 (nfr.md "BoQ sheet: 20k lines"): the sheet scrolls smoothly at 20,000 lines and the
 * Group by switch stays under 300 ms client-side. The run's real Duplex lines are repeated to 20,000
 * and served in place of `GET /runs/{id}/lines`.
 *
 * The scroll target holds under `next dev` too. The switch budget is the NFR's 300 ms against a
 * production build (`E2E_PRODUCTION=1` with `next start` on the app port; measured 27 ms on
 * 2026-11-12) and a regression bound under `next dev`, whose development React is about ten times
 * slower here (measured 379 ms). TS-002 measures production on staging.
 */
const SWITCH_BUDGET_MS = process.env.E2E_PRODUCTION === "1" ? 300 : 1000;

const DUPLEX = path.resolve(__dirname, "..", "..", "..", "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");
const LINES = 20_000;
test.describe.configure({ timeout: 300_000 });

test("F06-AC11 20,000 lines: smooth scrolling and a fast Group by switch", async ({ page }) => {
  const { url, run, olivia } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  const real = (await apiAs<{ items: { key: string; trace: { elements: unknown[] } }[] }>(olivia, "GET", `/runs/${run.id}/lines`)).items;
  // Repeat the real lines with unique keys; traces keep two elements so the payload stays realistic but small.
  const big = Array.from({ length: LINES }, (_, i) => {
    const l = real[i % real.length]!;
    return { ...l, key: `${l.key}#${i}`, sortIndex: i, trace: { ...l.trace, elements: l.trace.elements.slice(0, 2) } };
  });
  await page.route(`**/api/v1/runs/${run.id}/lines?*`, (route) => route.fulfill({ json: { items: big, total: big.length, nextCursor: null } }));

  await page.setViewportSize({ width: 1440, height: 1000 });
  await signInAs(page, "olivia");
  await page.goto(url);
  const grid = page.getByTestId("sheet-grid");
  await expect(grid).toHaveAttribute("data-lines", String(LINES), { timeout: 30_000 });
  // Only the visible rows (plus overscan) are in the DOM.
  expect(await page.getByTestId("sheet-line").count()).toBeLessThan(120);

  // Scroll for 3 s, a screenful per few frames, and record the time between frames.
  const frames = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const el = document.querySelector<HTMLElement>('[data-testid="sheet-grid"]')!;
        const out: number[] = [];
        let last = performance.now();
        const end = last + 3000;
        const step = (now: number) => {
          out.push(now - last);
          last = now;
          el.scrollTop += 240;
          if (now < end) requestAnimationFrame(step);
          else resolve(out.slice(1));
        };
        requestAnimationFrame(step);
      }),
  );
  const sorted = [...frames].sort((a, b) => a - b);
  const fps = frames.length / (frames.reduce((s, f) => s + f, 0) / 1000);
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
  console.log(`[perf] scroll at ${LINES} lines: ${fps.toFixed(1)} fps average, p95 frame ${p95.toFixed(1)} ms, ${frames.length} frames`);
  expect(fps).toBeGreaterThanOrEqual(50);
  expect(p95).toBeLessThan(50);

  // Group by switch, measured in the page: from the change to the first regrouped frame.
  const switchMs = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const select = document.querySelector<HTMLSelectElement>('[data-testid="group-by"]')!;
        const grid = document.querySelector<HTMLElement>('[data-testid="sheet-grid"]')!;
        grid.scrollTop = 0;
        const before = document.querySelector('[data-testid="sheet-group"]')?.getAttribute("data-group");
        const t0 = performance.now();
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, select.options[1]!.value);
        select.dispatchEvent(new Event("change", { bubbles: true }));
        const check = () => {
          const now = document.querySelector('[data-testid="sheet-group"]')?.getAttribute("data-group");
          if (now !== before) resolve(performance.now() - t0);
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }),
  );
  console.log(`[perf] group by switch at ${LINES} lines: ${switchMs.toFixed(0)} ms`);
  expect(switchMs).toBeLessThan(SWITCH_BUDGET_MS);
  await expect(grid).toHaveAttribute("data-lines", String(LINES));
});
