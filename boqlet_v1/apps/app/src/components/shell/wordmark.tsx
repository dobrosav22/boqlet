import { APP_NAME } from "@/config";
import { cn } from "@/lib/utils";

/** The wordmark: Inter Tight 800 until the owner supplies the SVG (design-guidelines.md "Brand"). */
export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("display text-[22px] leading-none lowercase", className)}>{APP_NAME}</span>;
}
