/**
 * F01: orgs, members, invitations, my profile (FE-005). Behaviour per F01 "Behaviour" and
 * 03-domain/permissions.md; error codes per conventions.md.
 */
import { randomBytes } from "node:crypto";
import { audit } from "../audit.js";
import { now, nowIso } from "../clock.js";
import { emit } from "../events.js";
import { conflict, forbidden, HttpError, limitReached, notFound } from "../http.js";
import { newId } from "../ids.js";
import { sendEmail } from "../outbox.js";
import { memberOrg, orgVisible, requireOrgAction, roleIn } from "../permissions.js";
import { json, noContent, type Handlers } from "../router.js";
import { db, persist, type InvitationRec, type MembershipRec, type OrgRec, type OrgRole, type UserRec } from "../store.js";

const APP_URL = () => process.env.APP_URL ?? "http://localhost:3000";
const INVITATION_DAYS = 14;

type Body = Record<string, unknown>;

/** Defaults for a new org (F15 §11: thousands separated by U+202F, decimal mark from the locale). */
export const DEFAULT_ORG_SETTINGS: OrgRec["settings"] = {
  fourEyes: false,
  defaultLocale: "en",
  defaultCurrency: "EUR",
  defaultUnitSystem: "metric",
  publicLinksAllowed: true,
  approvalRequired: false,
  numberFormat: { decimal: ".", thousands: " " },
  defaultLanguage: "en",
};

const ownersOf = (orgId: string) => db().memberships.filter((m) => m.orgId === orgId && m.role === "owner");
const userRef = (id: string) => {
  const u = db().users.find((x) => x.id === id);
  return u ? { id: u.id, name: u.name, email: u.email } : { id, name: "Unknown" };
};

function invitationStatus(inv: InvitationRec): "pending" | "accepted" | "revoked" | "expired" {
  if (inv.status === "pending" && new Date(inv.expiresAt).getTime() < now().getTime()) return "expired";
  return inv.status;
}

const invitationView = (inv: InvitationRec) => ({
  id: inv.id,
  email: inv.email,
  role: inv.role,
  status: invitationStatus(inv),
  expiresAt: inv.expiresAt,
  invitedBy: userRef(inv.invitedBy),
});

const membershipView = (m: MembershipRec) => ({
  user: db().users.find((u) => u.id === m.userId)!,
  role: m.role,
  createdAt: m.createdAt,
  ...(m.lastActiveAt ? { lastActiveAt: m.lastActiveAt } : {}),
});

/** Seats in use: members plus pending invitations (F01 §5). */
export function seatsInUse(orgId: string) {
  const members = db().memberships.filter((m) => m.orgId === orgId).length;
  const pending = db().invitations.filter((i) => i.orgId === orgId && invitationStatus(i) === "pending").length;
  return members + pending;
}

export function planLimits(org: OrgRec) {
  return db().plans.find((p) => p.id === org.planId)?.entitlements ?? {};
}

function sendInvitationEmail(org: OrgRec, inv: InvitationRec, by: UserRec) {
  const link = `${APP_URL()}/invite/${inv.token}`;
  sendEmail({
    to: inv.email,
    kind: "invitation",
    subject: `${by.name} invited you to ${org.name}`,
    html: `<p>${esc(by.name)} invited you to join <b>${esc(org.name)}</b> on boqlet as ${inv.role}.</p><p><a href="${link}">Accept the invitation</a></p><p>The link expires on ${inv.expiresAt.slice(0, 10)}.</p>`,
  });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
const token = () => randomBytes(24).toString("base64url");
const changed = (entityType: string, entityId: string, change: "created" | "updated" | "deleted", userIds?: string[]) =>
  emit("entity.changed", { entityType, entityId, change }, { userIds });
const orgMemberIds = (orgId: string) => db().memberships.filter((m) => m.orgId === orgId).map((m) => m.userId);

/** `Org.setup` as the contract shows it, with the user who started it. */
function setupView(setup: NonNullable<OrgRec["setup"]>) {
  const by = setup.startedBy?.id ? db().users.find((u) => u.id === setup.startedBy!.id) : undefined;
  return { ...setup, ...(by ? { startedBy: { id: by.id, name: by.name, email: by.email } } : {}) };
}

export const orgHandlers: Handlers = {
  /** F16: the setup wizard's progress; `204` when the org never started it. Every member may read it. */
  getOrgSetup({ user, params }) {
    const { org } = memberOrg(user!, params.orgId!);
    return org.setup ? json(setupView(org.setup)) : new Response(null, { status: 204 });
  },

  /** F16 "Leaving and resuming": progress is saved step by step; `done` sets `completedAt`. */
  putOrgSetup({ user, params, body }) {
    const { org } = requireOrgAction(user!, params.orgId!, "finishSetup");
    const b = body as { status?: "in_progress" | "done"; step?: NonNullable<OrgRec["setup"]>["step"]; modelVersionId?: string | null; ruleSetPresetId?: string; classificationPresetId?: string; dictionaryPresetId?: string };
    const at = nowIso();
    const prev = org.setup;
    const next: NonNullable<OrgRec["setup"]> = {
      ...(prev ?? { status: "in_progress", step: "start", startedBy: { id: user!.id, name: user!.name, email: user!.email } }),
      ...(b.status ? { status: b.status } : {}),
      ...(b.step ? { step: b.step } : {}),
      ...(b.ruleSetPresetId ? { ruleSetPresetId: b.ruleSetPresetId } : {}),
      ...(b.classificationPresetId ? { classificationPresetId: b.classificationPresetId } : {}),
      ...(b.dictionaryPresetId ? { dictionaryPresetId: b.dictionaryPresetId } : {}),
      updatedAt: at,
    };
    if (b.modelVersionId !== undefined) {
      if (b.modelVersionId) next.modelVersionId = b.modelVersionId;
      else delete next.modelVersionId;
    }
    if (b.status === "done" && prev?.status !== "done") next.completedAt = at;
    if (b.status === "in_progress") delete next.completedAt;
    org.setup = next;
    persist();
    if (b.status === "done" && prev?.status !== "done") audit({ orgId: org.id, actorId: user!.id, action: "org.setup_done", subjectType: "org", subjectId: org.id, data: {} });
    changed("org", org.id, "updated", orgMemberIds(org.id));
    return json(setupView(next));
  },

  updateMe({ user, body }) {
    const { name, locale } = body as { name?: string; locale?: string };
    const me = db().users.find((u) => u.id === user!.id)!;
    if (name !== undefined) {
      if (!name.trim()) throw new HttpError(400, "invalid_body", "The name can't be empty.");
      me.name = name.trim();
    }
    if (locale !== undefined) me.locale = locale;
    persist();
    changed("user", me.id, "updated", [me.id]);
    return json(me);
  },

  listOrgs({ user }) {
    const ids = new Set(db().memberships.filter((m) => m.userId === user!.id).map((m) => m.orgId));
    return json(db().orgs.filter((o) => ids.has(o.id) && orgVisible(o.id)));
  },

  createOrg({ user, body }) {
    const { name, slug, settings } = body as { name: string; slug: string; settings?: OrgRec["settings"] };
    if (!name.trim()) throw new HttpError(400, "invalid_body", "The name can't be empty.");
    if (db().orgs.some((o) => o.slug === slug)) throw conflict("slug_taken", `The address ${slug} is taken.`, { slug });
    const at = nowIso();
    const org: OrgRec = { id: newId(), name: name.trim(), slug, planId: "free", settings: { ...DEFAULT_ORG_SETTINGS, ...settings }, createdAt: at };
    db().orgs.push(org);
    db().memberships.push({ orgId: org.id, userId: user!.id, role: "owner", createdAt: at });
    persist();
    audit({ orgId: org.id, actorId: user!.id, action: "org.created", subjectType: "org", subjectId: org.id, data: { name: org.name, slug } });
    changed("org", org.id, "created", [user!.id]);
    return json(org, 201);
  },

  getOrg({ user, params }) {
    return json(memberOrg(user!, params.orgId!).org);
  },

  updateOrg({ user, params, body }) {
    const { org } = requireOrgAction(user!, params.orgId!, "editOrgSettings");
    const { name, slug, settings } = body as { name?: string; slug?: string; settings?: OrgRec["settings"] };
    if (slug !== undefined && slug !== org.slug && db().orgs.some((o) => o.slug === slug)) throw conflict("slug_taken", `The address ${slug} is taken.`, { slug });
    // Review and approval is a plan feature (F09 §4, 05-plans-and-limits.md `approvalWorkflow`).
    if (settings?.approvalRequired === true && !org.settings?.approvalRequired && planLimits(org).approvalWorkflow !== true) throw limitReached("approvalWorkflow", 0, 0);
    const before = { name: org.name, slug: org.slug };
    if (name !== undefined) {
      if (!name.trim()) throw new HttpError(400, "invalid_body", "The name can't be empty.");
      org.name = name.trim();
    }
    if (slug !== undefined) org.slug = slug;
    if (settings !== undefined) org.settings = { ...org.settings, ...settings };
    persist();
    audit({ orgId: org.id, actorId: user!.id, action: "org.updated", subjectType: "org", subjectId: org.id, data: { before, fields: Object.keys(body as Body) } });
    changed("org", org.id, "updated", orgMemberIds(org.id));
    return json(org);
  },

  deleteOrg({ user, params, body }) {
    const { org } = requireOrgAction(user!, params.orgId!, "deleteOrg");
    if ((body as { confirmName: string }).confirmName !== org.name) throw new HttpError(400, "confirm_mismatch", "Type the organisation's name exactly to confirm.");
    const members = orgMemberIds(org.id);
    db().deletedOrgIds.push(org.id);
    persist();
    audit({ orgId: org.id, actorId: user!.id, action: "org.deleted", subjectType: "org", subjectId: org.id });
    for (const id of members) {
      const u = db().users.find((x) => x.id === id);
      if (u) sendEmail({ to: u.email, kind: "org_deleted", subject: `${org.name} is being deleted`, html: `<p>${esc(org.name)} was deleted by ${esc(user!.name)}. Its data is removed within 30 days.</p>` });
    }
    changed("org", org.id, "deleted", members);
    return new Response(null, { status: 202 });
  },

  listMembers({ user, params }) {
    memberOrg(user!, params.orgId!);
    return json(db().memberships.filter((m) => m.orgId === params.orgId).map(membershipView));
  },

  updateMember({ user, params, body }) {
    const { org, role: myRole } = requireOrgAction(user!, params.orgId!, "manageMembers");
    const target = db().memberships.find((m) => m.orgId === org.id && m.userId === params.userId);
    if (!target) throw notFound("member");
    const role = (body as { role: OrgRole }).role;
    if (target.userId === user!.id) throw conflict("own_role", "You can't change your own role.");
    // Only owners make owners, or change an owner's role.
    if ((role === "owner" || target.role === "owner") && myRole !== "owner") throw forbidden("owner");
    if (target.role === "owner" && role !== "owner" && ownersOf(org.id).length === 1) throw conflict("last_owner", "An organisation needs at least one owner.");
    const from = target.role;
    target.role = role;
    persist();
    audit({ orgId: org.id, actorId: user!.id, action: "member.role_changed", subjectType: "user", subjectId: target.userId, data: { from, to: role } });
    changed("membership", target.userId, "updated", orgMemberIds(org.id));
    return json(membershipView(target));
  },

  removeMember({ user, params }) {
    const self = params.userId === user!.id;
    // Anyone may leave; removing others needs manageMembers.
    const { org, role: myRole } = self ? memberOrg(user!, params.orgId!) : requireOrgAction(user!, params.orgId!, "manageMembers");
    const target = db().memberships.find((m) => m.orgId === org.id && m.userId === params.userId);
    if (!target) throw notFound("member");
    if (!self && target.role === "owner" && myRole !== "owner") throw forbidden("owner");
    if (target.role === "owner" && ownersOf(org.id).length === 1) throw conflict("last_owner", "An organisation needs at least one owner.");
    db().memberships.splice(db().memberships.indexOf(target), 1);
    // Their project memberships in this org go too (F01 §8).
    const orgProjects = new Set(db().projects.filter((p) => p.orgId === org.id).map((p) => p.id));
    db().projectMembers = db().projectMembers.filter((m) => !(m.userId === target.userId && orgProjects.has(m.projectId)));
    persist();
    audit({ orgId: org.id, actorId: user!.id, action: "member.removed", subjectType: "user", subjectId: target.userId, data: { role: target.role, left: self } });
    changed("membership", target.userId, "deleted", [...orgMemberIds(org.id), target.userId]);
    return noContent();
  },

  listOrgInvitations({ user, params }) {
    requireOrgAction(user!, params.orgId!, "manageMembers");
    return json(db().invitations.filter((i) => i.orgId === params.orgId && i.status !== "revoked").map(invitationView));
  },

  inviteMember({ user, params, body }) {
    const { org } = requireOrgAction(user!, params.orgId!, "manageMembers");
    const { email, role } = body as { email: string; role: OrgRole };
    if (role === "owner" && roleIn(org.id, user!.id) !== "owner") throw forbidden("owner");
    const lower = email.trim().toLowerCase();
    const member = db().memberships.find((m) => m.orgId === org.id && db().users.find((u) => u.id === m.userId)?.email.toLowerCase() === lower);
    if (member) throw conflict("already_member", `${email} is already a member.`);
    if (db().invitations.some((i) => i.orgId === org.id && i.email.toLowerCase() === lower && invitationStatus(i) === "pending")) {
      throw conflict("already_invited", `${email} has a pending invitation; resend it instead.`);
    }
    const max = planLimits(org).seats;
    const current = seatsInUse(org.id);
    if (max !== undefined && current >= max) throw limitReached("seats", current, max);
    const at = nowIso();
    const inv: InvitationRec = {
      id: newId(),
      orgId: org.id,
      email: email.trim(),
      role,
      token: token(),
      status: "pending",
      expiresAt: new Date(now().getTime() + INVITATION_DAYS * 86_400_000).toISOString(),
      invitedBy: user!.id,
      createdAt: at,
    };
    db().invitations.push(inv);
    persist();
    sendInvitationEmail(org, inv, user!);
    audit({ orgId: org.id, actorId: user!.id, action: "member.invited", subjectType: "invitation", subjectId: inv.id, data: { email: inv.email, role } });
    changed("invitation", inv.id, "created", orgMemberIds(org.id));
    return json(invitationView(inv), 201);
  },

  revokeOrgInvitation({ user, params }) {
    const { org } = requireOrgAction(user!, params.orgId!, "manageMembers");
    const inv = db().invitations.find((i) => i.id === params.invitationId && i.orgId === org.id);
    if (!inv) throw notFound("invitation");
    if (inv.status === "pending") {
      inv.status = "revoked";
      persist();
      audit({ orgId: org.id, actorId: user!.id, action: "member.invitation_revoked", subjectType: "invitation", subjectId: inv.id, data: { email: inv.email } });
      changed("invitation", inv.id, "updated", orgMemberIds(org.id));
    }
    return noContent();
  },

  resendOrgInvitation({ user, params }) {
    const { org } = requireOrgAction(user!, params.orgId!, "manageMembers");
    const inv = db().invitations.find((i) => i.id === params.invitationId && i.orgId === org.id);
    if (!inv) throw notFound("invitation");
    if (inv.status !== "pending") throw conflict("invalid_transition", `The invitation is ${inv.status}.`, { status: inv.status });
    inv.token = token();
    inv.expiresAt = new Date(now().getTime() + INVITATION_DAYS * 86_400_000).toISOString();
    persist();
    sendInvitationEmail(org, inv, user!);
    audit({ orgId: org.id, actorId: user!.id, action: "member.invitation_resent", subjectType: "invitation", subjectId: inv.id, data: { email: inv.email } });
    return json(invitationView(inv));
  },

  previewOrgInvitation({ params }) {
    const inv = db().invitations.find((i) => i.token === params.token);
    const org = inv && db().orgs.find((o) => o.id === inv.orgId && orgVisible(o.id));
    if (!inv || !org) throw notFound("invitation");
    return json({ orgName: org.name, email: inv.email, role: inv.role, status: invitationStatus(inv) });
  },

  acceptOrgInvitation({ user, params }) {
    const inv = db().invitations.find((i) => i.token === params.token);
    const org = inv && db().orgs.find((o) => o.id === inv.orgId && orgVisible(o.id));
    if (!inv || !org) throw notFound("invitation");
    const status = invitationStatus(inv);
    if (status !== "pending") throw conflict("invalid_transition", `The invitation is ${status}.`, { status });
    if (inv.email.toLowerCase() !== user!.email.toLowerCase()) {
      throw conflict("email_mismatch", "The invitation was sent to another email address.", { invitedEmail: inv.email });
    }
    if (roleIn(org.id, user!.id)) throw conflict("already_member", "You are already a member.");
    // The seat was counted when the invitation was sent, so accepting never hits the limit (F01).
    const membership: MembershipRec = { orgId: org.id, userId: user!.id, role: inv.role, createdAt: nowIso() };
    db().memberships.push(membership);
    inv.status = "accepted";
    inv.acceptedBy = user!.id;
    persist();
    audit({ orgId: org.id, actorId: user!.id, action: "member.joined", subjectType: "user", subjectId: user!.id, data: { role: inv.role, invitationId: inv.id } });
    changed("membership", user!.id, "created", orgMemberIds(org.id));
    return json(membershipView(membership));
  },

  listOrgAudit({ user, params, query }) {
    const { org } = requireOrgAction(user!, params.orgId!, "seeAudit");
    const limit = Math.min(Number(query.limit ?? 100), 1000);
    const offset = Number(query.cursor ?? 0) || 0;
    const items = db()
      .audit.filter((a) => a.orgId === org.id)
      .filter((a) => !query.actorId || a.actorId === query.actorId)
      .filter((a) => !query.action || a.action === query.action)
      .filter((a) => !query.entityType || a.subjectType === query.entityType)
      .filter((a) => !query.from || a.at >= String(query.from))
      .filter((a) => !query.to || a.at <= String(query.to))
      .sort((a, b) => b.at.localeCompare(a.at));
    const page = items.slice(offset, offset + limit).map((a) => ({
      id: a.id,
      ...(a.actorId ? { actor: userRef(a.actorId), actorKind: "user" as const } : { actorKind: "system" as const }),
      action: a.action,
      entityType: a.subjectType,
      entityId: a.subjectId,
      projectId: a.projectId ?? null,
      data: a.data ?? {},
      at: a.at,
    }));
    return json({ items: page, nextCursor: offset + limit < items.length ? String(offset + limit) : null });
  },

  getAttention({ user, params }) {
    memberOrg(user!, params.orgId!);
    return json([]); // "Needs you" is filled by FE-006 and later tasks.
  },
};
