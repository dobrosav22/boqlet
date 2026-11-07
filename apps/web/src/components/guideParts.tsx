import type { ReactNode } from "react";

/** The public NIBS Duplex sample, served next to the web app (vite.config.ts serves it from fixtures/). */
export const SAMPLE_MODEL = {
  url: "/samples/Ifc2x3_Duplex_Architecture.ifc",
  fileName: "Ifc2x3_Duplex_Architecture.ifc",
  label: "Duplex sample, 2.4 MB",
};

export type GuideLang = "sr" | "en";

export interface ContentProps {
  onOpenBoq: () => void;
  onLoadSample: () => void;
}

/** One guide section. Its id starts with "guide-", so /#guide-<name> opens the guide at it. */
export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="guide-section">
      <h2>
        {title}
        <a className="guide-anchor" href={`#${id}`} aria-label={title} title="#">
          #
        </a>
      </h2>
      {children}
    </section>
  );
}
