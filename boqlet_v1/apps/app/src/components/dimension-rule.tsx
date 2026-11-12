import { cn } from "@/lib/utils";

/**
 * The dimension line (design-guidelines.md): a 2 px rule with 10 px end ticks and, optionally, a
 * measurement above it. Blue when it shows progress (`progress` 0…1 draws that share in blue).
 */
export function DimensionRule({ label, progress, className }: { label?: string; progress?: number; className?: string }) {
  const share = progress === undefined ? 1 : Math.max(0, Math.min(1, progress));
  const color = progress === undefined ? "bg-foreground" : "bg-link";
  return (
    <div className={cn("flex w-full flex-col gap-1", className)} aria-hidden={label === undefined ? true : undefined}>
      {label !== undefined && <span className="self-center text-ui tabular-nums">{label}</span>}
      <div className="relative h-2.5">
        <span className={cn("absolute top-0 left-0 h-2.5 w-0.5", color)} />
        <span className="absolute top-1 right-0 left-0 h-0.5 bg-border" />
        <span
          className={cn("absolute top-1 left-0 h-0.5 transition-[width] duration-200", color)}
          style={{ width: `${share * 100}%` }}
        />
        <span className={cn("absolute top-0 right-0 h-2.5 w-0.5", share === 1 ? color : "bg-border")} />
      </div>
    </div>
  );
}
