import { describe, expect, it } from "vitest";
import { client } from "../support/env";
import { signUp, uniqueEmail, user, type TestUser } from "../support/users";

/** F02 projects: acceptance criteria and behaviour, through the API only. */

const slug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const PERMISSION_KEYS = [
  "view", "edit", "archive", "manageMembers", "editModels", "editBoqs", "answerQuestions", "editLines",
  "editPresets", "saveVersion", "approve", "confirm", "reopen", "share", "revokeShares", "seeAudit",
].sort();

async function freeOrg() {
  const owner = await signUp("Project Owner", uniqueEmail("proj"));
  const { data: org } = await client(owner.token).POST("/orgs", { body: { name: "Projects Firm", slug: slug("proj") } });
  return { owner, org: org! };
}
const createProject = (u: TestUser, orgId: string, name: string, extra: Record<string, unknown> = {}) =>
  client(u.token).POST("/orgs/{orgId}/projects", { params: { path: { orgId } }, body: { name, ...extra } });

async function studioDemo() {
  const olivia = await user("olivia");
  const { data } = await client(olivia.token).GET("/me");
  return data!.memberships.find((m) => m.org.slug === "studio-demo")!.org;
}

describe("F02 projects", () => {
  it("the creator is the lead; the project gets its own dictionary and the org's defaults", async () => {
    const { owner, org } = await freeOrg();
    const { data: project, response } = await createProject(owner, org.id, "Tower A", { code: "TA-1", client: "City" });
    expect(response.status).toBe(201);
    expect(project).toMatchObject({ name: "Tower A", code: "TA-1", status: "active", myRole: "lead", currency: "EUR", unitSystem: "metric" });
    expect(project!.projectDictionaryId).toBeTruthy();
    expect(project!.defaults.ruleSetVersionId).toBeTruthy();
    expect(Object.keys(project!.permissions).sort()).toEqual(PERMISSION_KEYS);
  });

  it("F02-AC1 creating beyond activeProjects answers 402; archiving one frees the slot; the sample doesn't count", async () => {
    const { owner, org } = await freeOrg(); // Free plan: one active project
    const { data: first } = await createProject(owner, org.id, "First");
    const over = await createProject(owner, org.id, "Second");
    expect(over.response.status).toBe(402);
    expect(over.error).toMatchObject({ code: "limit_reached", details: { limit: "activeProjects", current: 1, max: 1 } });
    const sample = await createProject(owner, org.id, "Duplex sample", { sample: "duplex" });
    expect(sample.response.status).toBe(201);
    expect(sample.data!.sample).toBe(true);
    await client(owner.token).POST("/projects/{projectId}/archive", { params: { path: { projectId: first!.id } } });
    expect((await createProject(owner, org.id, "Second")).response.status).toBe(201);
    // Restoring the first would exceed the limit again.
    const restore = await client(owner.token).POST("/projects/{projectId}/unarchive", { params: { path: { projectId: first!.id } } });
    expect(restore.response.status).toBe(402);
  });

  it("F02-AC2 a member without a project role doesn't see the project and gets 404", async () => {
    const org = await studioDemo();
    const ivana = await user("ivana"); // library editor, not on the Duplex project
    const { data: list } = await client(ivana.token).GET("/orgs/{orgId}/projects", { params: { path: { orgId: org.id } } });
    expect(list!.map((p) => p.name)).not.toContain("Duplex");
    const olivia = await user("olivia");
    const { data: all } = await client(olivia.token).GET("/orgs/{orgId}/projects", { params: { path: { orgId: org.id } } });
    const duplex = all!.find((p) => p.name === "Duplex")!;
    const direct = await client(ivana.token).GET("/projects/{projectId}", { params: { path: { projectId: duplex.id } } });
    expect(direct.response.status).toBe(404);
    const victor = await user("victor");
    const asViewer = await client(victor.token).GET("/projects/{projectId}", { params: { path: { projectId: duplex.id } } });
    expect(asViewer.data!.myRole).toBe("viewer");
    expect(asViewer.data!.permissions).toMatchObject({ view: true, edit: false, editBoqs: false });
  });

  it("F02-AC3 project members are org members only", async () => {
    const { owner, org } = await freeOrg();
    const { data: project } = await createProject(owner, org.id, "Members");
    const outsider = await signUp("Outsider", uniqueEmail("out"));
    const refused = await client(owner.token).POST("/projects/{projectId}/members", { params: { path: { projectId: project!.id } }, body: { userId: outsider.id, role: "viewer" } });
    expect(refused.response.status).toBe(409);
    expect(refused.error).toMatchObject({ code: "not_org_member" });
  });

  it("an org member added to a project sees it with that role", async () => {
    const org = await studioDemo();
    const olivia = await user("olivia");
    const ivana = await user("ivana");
    const { data: project } = await createProject(olivia, org.id, `Team ${Date.now()}`);
    const added = await client(olivia.token).POST("/projects/{projectId}/members", { params: { path: { projectId: project!.id } }, body: { userId: ivana.id, role: "estimator" } });
    expect(added.response.status).toBe(201);
    const { data } = await client(ivana.token).GET("/projects/{projectId}", { params: { path: { projectId: project!.id } } });
    expect(data!.myRole).toBe("estimator");
    // Only leads manage members.
    const marko = await user("marko");
    const denied = await client(ivana.token).POST("/projects/{projectId}/members", { params: { path: { projectId: project!.id } }, body: { userId: marko.id, role: "viewer" } });
    expect(denied.response.status).toBe(403);
  });

  it("F02-AC4 an archived project rejects writes with 409 project_archived and can be restored", async () => {
    const { owner, org } = await freeOrg();
    const { data: project } = await createProject(owner, org.id, "Archive me");
    const path = { projectId: project!.id };
    const { data: archived } = await client(owner.token).POST("/projects/{projectId}/archive", { params: { path } });
    expect(archived!.status).toBe("archived");
    expect(archived!.permissions).toMatchObject({ view: true, edit: false, editBoqs: false, archive: true });
    const write = await client(owner.token).PATCH("/projects/{projectId}", { params: { path }, body: { name: "Changed" } });
    expect(write.response.status).toBe(409);
    expect(write.error).toMatchObject({ code: "project_archived" });
    const { data: restored } = await client(owner.token).POST("/projects/{projectId}/unarchive", { params: { path } });
    expect(restored!.status).toBe("active");
  });

  it("project actions are audited and listed for leads", async () => {
    const { owner, org } = await freeOrg();
    const { data: project } = await createProject(owner, org.id, "Audited");
    await client(owner.token).PATCH("/projects/{projectId}", { params: { path: { projectId: project!.id } }, body: { client: "New client" } });
    const { data } = await client(owner.token).GET("/projects/{projectId}/audit", { params: { path: { projectId: project!.id } } });
    expect(data!.items.map((e) => e.action)).toEqual(expect.arrayContaining(["project.created", "project.updated"]));
  });
});
