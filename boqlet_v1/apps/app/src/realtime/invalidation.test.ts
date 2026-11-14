import { describe, expect, it } from "vitest";
import { invalidationsFor } from "./invalidation";

describe("invalidationsFor (architecture.md, data layer rule 4)", () => {
  it("refetches the model version and the project's models when a parse finishes", () => {
    expect(invalidationsFor({ event: "job.finished", data: { jobId: "j", type: "parse", subjectId: "v1", projectId: "p1" } })).toEqual([
      ["job", "j"],
      ["jobProgress", "j"],
      ["modelVersion", "v1"],
      ["models", "p1"],
      ["modelVersions"],
      ["model"],
      ["attention"],
    ]);
  });

  it("refetches the run, revisions, runs and BoQs when a run finishes", () => {
    expect(invalidationsFor({ event: "job.finished", data: { type: "run", subjectId: "r1" } })).toEqual([["run", "r1"], ["revision"], ["runs"], ["boq"], ["attention"]]);
  });

  it("refetches an entity and its lists when it changes", () => {
    expect(invalidationsFor({ event: "entity.changed", data: { entityType: "project", entityId: "p1", change: "updated" } })).toEqual([
      ["project", "p1"],
      ["projects"],
    ]);
    expect(invalidationsFor({ event: "entity.changed", data: { entityType: "user", entityId: "u1" } })).toEqual([["user", "u1"], ["me"], ["members"]]);
  });

  it("refetches notifications and ignores what it doesn't know", () => {
    expect(invalidationsFor({ event: "notification.created", data: { id: "n" } })).toEqual([["notifications"], ["attention"]]);
    expect(invalidationsFor({ event: "boq.presence", data: {} })).toEqual([]);
    expect(invalidationsFor({ event: "boq.line_edited", data: { boqId: "b1", lineKeys: ["l"] } })).toEqual([["overrides", "b1"], ["manualItems", "b1"]]);
    expect(invalidationsFor({ event: "entity.changed", data: {} })).toEqual([]);
  });
});
