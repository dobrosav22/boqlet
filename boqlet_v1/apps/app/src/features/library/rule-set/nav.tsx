"use client";

/**
 * Navigation inside the editor (tabs, "Used by" links, jumps). These are spans with a button or tab
 * role, not buttons: read-only users get the editor inside a disabled <fieldset>, which disables
 * every button in it, and they must still be able to move around (the PoC did the same for the
 * item sentences).
 */
import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

const onKey = (run: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    run();
  }
};

/** A link-looking control that keeps working in a disabled fieldset. */
export function NavLink({ onClick, children, title, className, ...rest }: { onClick: () => void; children: ReactNode; title?: string; className?: string; "data-testid"?: string }) {
  return (
    <span role="button" tabIndex={0} className={cn("cursor-pointer text-link hover:underline", className)} title={title} onClick={onClick} onKeyDown={onKey(onClick)} {...rest}>
      {children}
    </span>
  );
}

/** A row of tabs. */
export function TabBar<T extends string>({ tabs, value, onChange, label, quiet }: {
  tabs: { id: T; label: ReactNode; testId?: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  /** The smaller, second-level look (Advanced's sub-tabs). */
  quiet?: boolean;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex flex-wrap gap-1", !quiet && "border-b border-border")}>
      {tabs.map((tab) => {
        const on = tab.id === value;
        return (
          <span
            key={tab.id}
            role="tab"
            tabIndex={on ? 0 : -1}
            aria-selected={on}
            data-testid={tab.testId}
            className={cn(
              "cursor-pointer px-3 py-1.5 select-none",
              quiet ? "rounded-[var(--radius)] border border-border hover:bg-muted" : "label-caps -mb-px border-b-2 border-transparent hover:text-foreground",
              quiet ? on && "border-foreground bg-muted" : on ? "border-link text-foreground" : "text-muted-foreground",
            )}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => {
              const i = tabs.findIndex((x) => x.id === value);
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                onChange(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]!.id);
              } else onKey(() => onChange(tab.id))(e);
            }}
          >
            {tab.label}
          </span>
        );
      })}
    </div>
  );
}

/** A small status tag (inherited, changed here, your answer…). */
export function Tag({ children, tone = "quiet" }: { children: ReactNode; tone?: "quiet" | "changed" | "removed" }) {
  return (
    <span
      className={cn(
        "label-caps inline-flex items-center rounded-[var(--radius)] border px-1",
        tone === "changed" ? "border-link text-link" : tone === "removed" ? "border-error text-error" : "border-border text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
