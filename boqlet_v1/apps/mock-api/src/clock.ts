/**
 * The mock's clock: real time plus an offset that `/_dev/clock` and `/_test/clock` move, so
 * expiry and deadline behaviour can be tested without waiting (testing.md).
 */
let offsetMs = 0;

export const now = () => new Date(Date.now() + offsetMs);
export const nowIso = () => now().toISOString();

export function advance(ms: number) {
  offsetMs += ms;
  return now();
}
export function setNow(iso: string) {
  offsetMs = new Date(iso).getTime() - Date.now();
  return now();
}
export function resetClock() {
  offsetMs = 0;
  return now();
}
export const clockOffsetMs = () => offsetMs;
