import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A plain `<select>` styled like the inputs: for short fixed lists in forms. */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 rounded-[var(--radius)] border border-input bg-transparent px-2 text-ui outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
