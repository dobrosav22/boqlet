import { describe, expect, it } from "vitest";
import { client } from "../support/env";
import { expectSchema } from "../support/contract";
import { user, type SeedUser } from "../support/users";

describe("me: GET /me", () => {
  const expected: Record<SeedUser, [string, string][]> = {
    olivia: [
      ["small-firm", "owner"],
      ["studio-demo", "owner"],
    ],
    ivana: [["studio-demo", "library_editor"]],
    marko: [["studio-demo", "member"]],
    ana: [["studio-demo", "member"]],
    victor: [["studio-demo", "member"]],
    pat: [],
  };

  for (const [key, memberships] of Object.entries(expected) as [SeedUser, [string, string][]][]) {
    it(`returns ${key}'s seeded memberships in the contract's shape`, async () => {
      const u = await user(key);
      const { data, response } = await client(u.token).GET("/me");
      expect(response.status).toBe(200);
      await expectSchema("Me", data);
      expect(data!.user.id).toBe(u.id);
      expect(data!.memberships.map((m) => [m.org.slug, m.role]).sort()).toEqual(memberships);
    });
  }

  it("marks platform admins", async () => {
    const { data } = await client((await user("pat")).token).GET("/me");
    expect(data!.user.platformRole).toBe("admin");
  });
});
