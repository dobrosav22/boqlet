import { ROOT_URL } from "./env";

/**
 * The test-only clock (testing.md): `POST /_test/clock` on the mock and on Java (disabled in
 * production builds). Deadline and expiry scenarios move time instead of waiting.
 */
async function post(body: Record<string, unknown>): Promise<Date> {
  const res = await fetch(`${ROOT_URL}/_test/clock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`/_test/clock answered ${res.status}`);
  return new Date(((await res.json()) as { now: string }).now);
}

export const advanceClock = (ms: number) => post({ advanceMs: ms });
export const advanceDays = (days: number) => post({ advanceDays: days });
export const resetClock = () => post({ reset: true });
export async function serverNow(): Promise<Date> {
  const res = await fetch(`${ROOT_URL}/_test/clock`);
  return new Date(((await res.json()) as { now: string }).now);
}
