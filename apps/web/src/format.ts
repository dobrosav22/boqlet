export const qty = (v: number | null | undefined, unit?: string) => {
  if (v === null || v === undefined) return "";
  const whole = unit === "nr" || unit === "item";
  return v.toLocaleString("en-GB", {
    minimumFractionDigits: whole ? 0 : unit === "t" ? 3 : 2,
    maximumFractionDigits: whole ? 0 : unit === "t" ? 3 : 2,
  });
};

export const bytes = (n: number) =>
  n > 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export const ms = (n: number) => (n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(1)} s`);
