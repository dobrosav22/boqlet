import { useEffect, useRef, useState } from "react";
import { DEPLOYED } from "../api";
import { GuideEn } from "./guideEn";
import { GuideSr } from "./guideSr";
import type { ContentProps, GuideLang } from "./guideParts";

export { SAMPLE_MODEL, type GuideLang } from "./guideParts";

/**
 * The user guide inside the app, for engineers who made BoQs by hand and have never used this tool.
 * Written in Serbian and English (guideSr.tsx, guideEn.tsx: same sections, same ids). On-screen labels
 * stay in English in both, exactly as the app shows them. A link like /#guide-questions opens a section.
 */

const SECTIONS: [string, string, string][] = [
  ["guide-short", "Ukratko", "The short version"],
  ["guide-idea", "Osnovna ideja", "The idea"],
  ["guide-ifc", "Šta je IFC fajl", "What an IFC file is"],
  ["guide-file", "1. Učitajte fajl", "1. Give it a file"],
  ["guide-choose", "2. Pravila, šifre, nazivi", "2. Choose rules, codes, names"],
  ["guide-generate", "3. Napravite predmer", "3. Generate"],
  ["guide-sheet", "Čitanje predmera", "Reading the bill"],
  ["guide-3d", "3D prikaz", "The 3D view"],
  ["guide-log", "Dnevnik i ulazi", "Log and inputs"],
  ["guide-questions", "Pitanja", "Questions"],
  ["guide-excel", "Excel", "Excel"],
  ["guide-compare", "Poređenje dva predmera", "Comparing two bills"],
  ["guide-federation", "Više modela", "Several models"],
  ["guide-library", "Library: vaša pravila", "Library: your own rules"],
  ["guide-trust", "Pre nego što mu verujete", "Before you trust it"],
  ...(DEPLOYED ? ([["guide-demo", "O ovom online demu", "About this online demo"]] as [string, string, string][]) : []),
  ["guide-words", "Pojmovi", "Words used"],
];

const LANGS: [GuideLang, string][] = [
  ["sr", "Srpski"],
  ["en", "English"],
];

/**
 * The section being read: the last one whose heading has passed a line a third of the way down the
 * window, or the last section once the page is scrolled to the bottom. A section jumped to (menu click,
 * shared link) stays marked through the jump's own scrolling, even when it is too short to reach that line.
 */
function useCurrentSection(): [string, (id: string) => void] {
  const [current, setCurrent] = useState(SECTIONS[0][0]);
  const lockUntil = useRef(0);
  const pin = (id: string) => {
    setCurrent(id);
    lockUntil.current = performance.now() + 700;
  };
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (performance.now() < lockUntil.current) return;
      const line = window.innerHeight / 3;
      let id = SECTIONS[0][0];
      for (const [sid] of SECTIONS) {
        const el = document.getElementById(sid);
        if (el && el.getBoundingClientRect().top <= line) id = sid;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) id = SECTIONS[SECTIONS.length - 1][0];
      setCurrent(id);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const linked = location.hash.slice(1);
    if (SECTIONS.some(([id]) => id === linked)) pin(linked);
    else update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return [current, pin];
}

/** Sidebar contents in Guide mode: language and the table of contents, with the section being read marked. */
export function GuideToc({ lang, onLang, onOpenBoq }: { lang: GuideLang; onLang: (l: GuideLang) => void; onOpenBoq: () => void }) {
  const [current, pin] = useCurrentSection();
  return (
    <>
      <div className="guide-lang" role="group" aria-label="Language">
        {LANGS.map(([l, label]) => (
          <button key={l} className={lang === l ? "on" : ""} aria-pressed={lang === l} onClick={() => onLang(l)}>
            {label}
          </button>
        ))}
      </div>
      <p className="hint">
        {lang === "sr"
          ? "Za inženjere koji su predmere radili ručno, a sa IFC modelima se tek upoznaju."
          : "For engineers who have made bills of quantities by hand and are new to IFC models."}
      </p>
      <nav aria-label={lang === "sr" ? "Sadržaj" : "Contents"}>
        <ol className="guide-toc">
          {SECTIONS.map(([id, sr, en]) => (
            <li key={id}>
              <a href={`#${id}`} onClick={() => pin(id)} className={current === id ? "on" : undefined} aria-current={current === id ? "location" : undefined}>
                {lang === "sr" ? sr : en}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <button className="primary" onClick={onOpenBoq}>
        {lang === "sr" ? "Otvori Bill of quantities" : "Open the bill of quantities"}
      </button>
    </>
  );
}

/** The guide itself, in the main area. */
export function Guide({ lang, ...p }: ContentProps & { lang: GuideLang }) {
  // a shared link to a section (#guide-questions) arrives before the guide is drawn: scroll once it is
  useEffect(() => {
    const id = location.hash.slice(1);
    if (id.startsWith("guide-")) document.getElementById(id)?.scrollIntoView();
  }, []);
  return (
    <article className="guide" lang={lang}>
      {lang === "sr" ? <GuideSr {...p} /> : <GuideEn {...p} />}
    </article>
  );
}
