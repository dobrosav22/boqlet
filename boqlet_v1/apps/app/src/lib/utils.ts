import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** tailwind-merge, told about the type scale in app/globals.css so `text-ui` etc. count as font sizes. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["label", "ui", "prose", "title", "display-sm", "display", "display-lg"] }],
    },
  },
});

/** Merge class names, later Tailwind classes winning (the shadcn/ui helper). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
