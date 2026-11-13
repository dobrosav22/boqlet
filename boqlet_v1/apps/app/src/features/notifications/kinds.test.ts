import { readFileSync } from "node:fs";
import path from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/en/notifications.json";

/**
 * F13 (FE-034): every core notification kind is rendered through the catalogue, never shown as its
 * code. The kinds are F13's "Events" table as the mock keeps it (`apps/mock-api/src/notify.ts`).
 */
const notify = readFileSync(path.resolve(__dirname, "../../../../mock-api/src/notify.ts"), "utf8");
const block = notify.slice(notify.indexOf("const KINDS"), notify.indexOf("};", notify.indexOf("const KINDS")));
const kinds = [...block.matchAll(/"([a-z_]+\.[a-z_]+)"/g)].map((m) => m[1]!);

const t = createTranslator({ locale: "en", messages: { notifications: messages }, namespace: "notifications" });
const render = (key: string, values: Record<string, unknown>) => t(key as never, values as never) as string;

const SAMPLE: Record<string, unknown> = { boq: "Tender", model: "Architecture", version: 2, count: 3, type: "run", file: "a.xlsx", label: "A", reason: "Brief", by: "Ana", revision: "B", project: "Duplex", role: "estimator", limit: "seats", current: 4, max: 5 };

describe("notification kinds (F13)", () => {
  it("knows the kinds", () => {
    expect(kinds).toEqual(expect.arrayContaining(["job.succeeded", "boq.new_version_available", "revision.review_requested", "project_member.added", "limit.near", "limit.reached"]));
  });

  it.each(kinds)("%s has a message that renders with its params", (kind) => {
    const text = (messages.kinds as Record<string, string>)[kind.replaceAll(".", "_")];
    expect(text, `messages/en/notifications.json kinds.${kind.replaceAll(".", "_")}`).toBeTruthy();
    const out = render(`kinds.${kind.replaceAll(".", "_")}`, SAMPLE);
    expect(out).not.toMatch(/[{}]/);
  });

  it("names the limit in words", () => {
    expect(render("kinds.limit_near", { limit: "activeProjects", current: 8, max: 10 })).toBe("Your plan is nearly used up: active projects, 8 of 10");
  });
});
