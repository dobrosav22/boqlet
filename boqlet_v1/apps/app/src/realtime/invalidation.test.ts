import { describe, expect, it } from "vitest";
import { invalidationsFor } from "./invalidation";

describe("invalidationsFor (architecture.md, data layer rule 4)", () => {
  it("refetches the model version and the project's models when a parse finishes", () => {
    expect(invalidationsFor({ event: "job.finished", data: { jobId: "j", type: "parse", subjectId: "v1", projectId: "p1" } })).toEqual([
      ["job", "j"],
      ["modelVersion", "v1"],
      ["models", "p1"],
    ]);
  });

  it("refetches the run, revisions, runs and BoQs when a run finishes", () => {
    expect(invalidationsFor({ event: "job.finished", data: { type: "run", subjectId: "r1" } })).toEqual([["run", "r1"], ["revision"], ["runs"], ["boq"]]);
  });

  it("refetches an entity and its lists when it changes", () => {
    expect(invalidationsFor({ event: "entity.changed", data: { entityType: "project", entityId: "p1", change: "updated" } })).toEqual([
      ["project", "p1"],
      ["projects"],
    ]);
    expect(invalidationsFor({ event: "entity.changed", data: { entityType: "user", entityId: "u1" } })).toEqual([["user", "u1"], ["me"], ["members"]]);
  });

  it("refetches notifications and ignores what it doesn't know", () => {
    expect(invalidationsFor({ event: "notification.created", data: { id: "n" } })).toEqual([["notifications"]]);
    expect(invalidationsFor({ event: "boq.presence", data: {} })).toEqual([]);
    expect(invalidationsFor({ event: "entity.changed", data: {} })).toEqual([]);
  });
});
