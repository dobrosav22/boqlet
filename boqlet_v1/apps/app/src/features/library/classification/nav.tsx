"use client";

import { createContext, useContext, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Navigation inside the editor (tabs, story jumps, "rule …" links, page turns) must keep working for
 * people who may only view: the host disables every form control of a read-only editor with a
 * <fieldset disabled>, so these are focusable non-form elements with button semantics.
 */

const activate = (go: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    go();
  }
};

/** A link-styled control that moves around the editor (never changes the document). */
export function NavLink({ onClick, children, className, ...rest }: { onClick: () => void; children: ReactNode; className?: string; "data-testid"?: string; "aria-disabled"?: boolean }) {
  const off = rest["aria-disabled"];
  return (
    <span
      role="button"
      tabIndex={off ? -1 : 0}
      className={cn(off ? "text-muted-foreground" : "cursor-pointer text-link hover:underline", className)}
      onClick={off ? undefined : onClick}
      onKeyDown={off ? undefined : activate(onClick)}
      {...rest}
    >
      {children}
    </span>
  );
}

/** A part of a story sentence that jumps to where it is set: dotted underline, like the PoC. */
export function Jump({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <span role="button" tabIndex={0} className="cursor-pointer underline decoration-dotted underline-offset-4 hover:text-link" onClick={onClick} onKeyDown={activate(onClick)}>
      {children}
    </span>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, small }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: ReactNode; testId?: string }[]; small?: boolean }) {
  return (
    <div role="tablist" className={cn("flex flex-wrap gap-1 border-b border-border", small && "border-b-0")}>
      {tabs.map((tab) => (
        <span
          key={tab.id}
          role="tab"
          tabIndex={0}
          aria-selected={value === tab.id}
          data-testid={tab.testId}
          className={cn(
            "label-caps cursor-pointer border-b-2 px-3 py-2 hover:text-foreground",
            small && "rounded-[var(--radius)] border border-border px-2 py-1",
            value === tab.id ? (small ? "border-link text-link" : "border-link text-foreground") : small ? "text-muted-foreground" : "border-transparent text-muted-foreground",
          )}
          onClick={() => onChange(tab.id)}
          onKeyDown={activate(() => onChange(tab.id))}
        >
          {tab.label}
        </span>
      ))}
    </div>
  );
}

/** The code list's codes and titles, and the one <datalist> of codes every code picker uses. */
export interface CodesInfo {
  titles: Map<string, string>;
  listId: string;
}
export const CodesContext = createContext<CodesInfo>({ titles: new Map(), listId: "" });
export const useCodes = () => useContext(CodesContext);
