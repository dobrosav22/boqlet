import { apiAs, devUser, MOCK_URL } from "./helpers";

/**
 * Before the e2e tests: the seeded Studio Demo goes to the Enterprise plan (no limits). Most flows make
 * their own project in Studio, and a full run makes more than the Team plan's 50 active projects. Tests
 * of limits use their own free orgs (FE-019's `createOrg`), so nothing depends on Studio's plan.
 */
export default async function globalSetup() {
  const olivia = await devUser("olivia");
  const me = await apiAs<{ memberships: { org: { id: string; slug: string } }[] }>(olivia, "GET", "/me");
  const studio = me.memberships.find((m) => m.org.slug === "studio-demo")!.org;
  const res = await fetch(`${MOCK_URL}/_dev/checkout?org=${studio.id}&plan=enterprise`);
  if (!res.ok) throw new Error(`moving Studio Demo to Enterprise answered ${res.status}`);
}
