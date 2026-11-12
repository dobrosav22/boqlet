import { describe, expect, it } from "vitest";
import { client } from "../support/env";
import { expectSchema } from "../support/contract";

describe("billing: GET /plans", () => {
  it("is public and lists the plans of 00-product/05 in the contract's shape", async () => {
    const { data, response } = await client(null).GET("/plans");
    expect(response.status).toBe(200);
    expect(data!.map((p) => p.id)).toEqual(["free", "professional", "team", "enterprise"]);
    for (const plan of data!) await expectSchema("Plan", plan);
    const free = data!.find((p) => p.id === "free")!;
    expect(free.entitlements).toMatchObject({ seats: 2, activeProjects: 1, approvalWorkflow: false, exportWatermark: true });
  });
});
