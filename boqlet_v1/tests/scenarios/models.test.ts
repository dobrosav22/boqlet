import { beforeAll, describe, expect, it } from "vitest";
import { client } from "../support/env";
import { duplexBytes, uploadVersion, waitForVersion } from "../support/models";
import { signUp, uniqueEmail, user, type TestUser } from "../support/users";

/** F03 models and versions, and the ModelVersion and Job state machines, through the API only. */

const slug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

let owner: TestUser;
let projectId: string;
let readyVersion: { id: string; modelId: string };

async function newModel(name = "Architecture") {
  const { data, response } = await client(owner.token).POST("/projects/{projectId}/models", { params: { path: { projectId } }, body: { name, discipline: "detect" } });
  expect(response.status).toBe(201);
  return data!;
}

beforeAll(async () => {
  owner = await signUp("Model Owner", uniqueEmail("models"));
  const { data: org } = await client(owner.token).POST("/orgs", { body: { name: "Models Firm", slug: slug("models") } });
  const { data: project } = await client(owner.token).POST("/orgs/{orgId}/projects", { params: { path: { orgId: org!.id } }, body: { name: "Duplex" } });
  projectId = project!.id;
});

describe("ModelVersion: upload, parse, ready (F03)", () => {
  it("F03-AC1 awaiting_upload → queued → processing → ready, with the input-check summary and a succeeded parse job", async () => {
    const model = await newModel();
    const bytes = await duplexBytes();
    const completed = await uploadVersion(owner, model.id, bytes, "Ifc2x3_Duplex_Architecture.ifc");
    expect(["queued", "processing", "ready"]).toContain(completed.status);
    expect(completed.parseJobId).toBeTruthy();
    const ready = await waitForVersion(owner, completed.id);
    expect(ready.status).toBe("ready");
    expect(ready.summary!.ifcSchema).toBe("IFC2X3");
    expect(ready.summary!.elementCount).toBeGreaterThan(100);
    expect(ready.summary!.byClass.IfcWall ?? ready.summary!.byClass.IfcWallStandardCase).toBeGreaterThan(0);
    expect(Array.isArray(ready.summary!.checkDetails)).toBe(true);
    const job = await client(owner.token).GET("/jobs/{jobId}", { params: { path: { jobId: completed.parseJobId! } } });
    expect(job.data).toMatchObject({ type: "parse", status: "succeeded" });
    // "detect" takes the first version's discipline guess (F03 §1).
    const { data: after } = await client(owner.token).GET("/models/{modelId}", { params: { path: { modelId: model.id } } });
    expect(after!.discipline).not.toBe("detect");
    expect(after!.latestVersion!.id).toBe(ready.id);
    readyVersion = { id: ready.id, modelId: model.id };
  });

  it("F03-AC3 a non-IFC file fails with not_ifc, no job, and can't be retried", async () => {
    const model = await newModel("Notes");
    const version = await uploadVersion(owner, model.id, new TextEncoder().encode("hello, not a model"), "notes.ifc");
    expect(version.status).toBe("failed");
    expect(version.error).toMatchObject({ code: "not_ifc" });
    expect(version.parseJobId).toBeNull();
    const retry = await client(owner.token).POST("/model-versions/{versionId}/retry", { params: { path: { versionId: version.id } } });
    expect(retry.response.status).toBe(409);
  });

  it("F03-AC4 identical content in the org is parsed once (two versions, one job)", async () => {
    expect(readyVersion).toBeDefined();
    const bytes = await duplexBytes();
    const again = await uploadVersion(owner, readyVersion.modelId, bytes, "Ifc2x3_Duplex_Architecture.ifc");
    expect(again.status).toBe("ready");
    expect(again.parseJobId).toBeNull();
    expect(again.number).toBe(2);
    expect(again.identicalToVersion).toBe(1);
    const other = await newModel("Copy elsewhere");
    const elsewhere = await uploadVersion(owner, other.id, bytes, "copy.ifc");
    expect(elsewhere).toMatchObject({ status: "ready", parseJobId: null });
  });

  it("F03-AC6 a file over the plan's maxModelVersionMb is refused when the version is created", async () => {
    const model = await newModel("Huge");
    const res = await client(owner.token).POST("/models/{modelId}/versions", { params: { path: { modelId: model.id } }, body: { fileName: "huge.ifc", sizeBytes: 60 * 1024 * 1024 } });
    expect(res.response.status).toBe(402);
    expect(res.error).toMatchObject({ code: "limit_reached", details: { limit: "maxModelVersionMb", max: 50 } });
  });

  it("the names preview lists the model's names and how the dictionaries resolve them", async () => {
    expect(readyVersion).toBeDefined();
    const { data, response, error } = await client(owner.token).POST("/model-versions/{versionId}/names", { params: { path: { versionId: readyVersion.id } }, body: {} });
    expect(response.status, JSON.stringify(error)).toBe(200);
    expect(data!.names.length).toBeGreaterThan(0);
    expect(data!.names[0]).toHaveProperty("raw");
  });
});

describe("models: permissions", () => {
  it("a viewer sees models but can't add one", async () => {
    const olivia = await user("olivia");
    const victor = await user("victor");
    const { data: me } = await client(olivia.token).GET("/me");
    const studio = me!.memberships.find((m) => m.org.slug === "studio-demo")!.org;
    const { data: projects } = await client(olivia.token).GET("/orgs/{orgId}/projects", { params: { path: { orgId: studio.id } } });
    const duplex = projects!.find((p) => p.name === "Duplex")!;
    expect((await client(victor.token).GET("/projects/{projectId}/models", { params: { path: { projectId: duplex.id } } })).response.status).toBe(200);
    const denied = await client(victor.token).POST("/projects/{projectId}/models", { params: { path: { projectId: duplex.id } }, body: { name: "Nope" } });
    expect(denied.response.status).toBe(403);
  });
});
