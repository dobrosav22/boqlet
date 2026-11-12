import { cn } from "@/lib/utils";

/**
 * A poster composition (design-guidelines.md "The poster language"): squares, circles, quarter
 * circles and triangles in the poster colours on a grid. Only for the moments of arrival
 * (onboarding, wizard, sign-in, share page, project cards). Decorative: hidden from assistive tech.
 */
export function Poster({ variant = 0, className }: { variant?: number; className?: string }) {
  const v = Math.abs(variant) % 3;
  return (
    <div aria-hidden className={cn("relative grid aspect-square grid-cols-3 grid-rows-3 gap-2", className)}>
      {v === 0 && (
        <>
          <div className="col-span-2 row-span-2 rounded-[var(--radius-shape)] bg-[var(--data-blue)]" />
          <div className="rounded-full bg-[var(--data-orange)]" />
          <div className="rounded-tl-full rounded-[var(--radius-shape)] bg-[var(--data-yellow)]" />
          <div className="col-span-2 rounded-[var(--radius-shape)] bg-foreground" />
          <Triangle className="text-[var(--data-red)]" />
        </>
      )}
      {v === 1 && (
        <>
          <div className="rounded-full bg-[var(--data-yellow)]" />
          <div className="col-span-2 rounded-tr-full rounded-[var(--radius-shape)] bg-[var(--data-orange)]" />
          <Triangle className="row-span-2 text-foreground" />
          <div className="col-span-2 row-span-2 rounded-[var(--radius-shape)] bg-[var(--data-blue)]" />
        </>
      )}
      {v === 2 && (
        <>
          <div className="col-span-3 rounded-[var(--radius-shape)] bg-foreground" />
          <div className="row-span-2 rounded-bl-full rounded-[var(--radius-shape)] bg-[var(--data-red)]" />
          <div className="rounded-full bg-[var(--data-blue)]" />
          <div className="rounded-[var(--radius-shape)] bg-[var(--data-yellow)]" />
          <Triangle className="col-span-2 text-[var(--data-orange)]" />
        </>
      )}
    </div>
  );
}

function Triangle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cn("h-full w-full", className)}>
      <polygon points="6,94 50,8 94,94" fill="currentColor" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
    </svg>
  );
}
