# F01 Accounts, organisations, members

## Purpose

Anyone can sign up, create their firm's organisation and invite colleagues. One login works
across several orgs, guest access and bidding.

## Stories

- As a visitor, I sign up with email (and whatever methods the chosen auth provider offers) and
  land in onboarding.
- As a new user with no org, I create an org (name → slug) and start on the Free plan.
- As an owner/admin, I invite colleagues by email with a role; they get an email link.
- As an invitee, I open the link, sign in or sign up, and join the org.
- As a user in several orgs, I switch orgs from the top bar. The URL carries the org slug.
- As an owner, I change roles, remove members, transfer ownership.
- As any user, I edit my name and locale.

## Behaviour

1. **Sign-up / sign-in is delegated to the auth adapter** (P10). The app never shows a
   password form of its own unless the chosen provider requires embedded forms. After
   authentication the frontend calls `GET /me`.
2. `GET /me` returns `{user, memberships: [{org, role}], guestProjects: [...], bidInvitationsOpen: n}`.
   The backend creates the `User` row on first sight of a new `authSubject` (just in time).
3. **Routing after sign-in:**
   - pending invitation token in the session → accept it, go to that org;
   - else one membership → `/{orgSlug}`;
   - else several → the last-used org (stored client-side), else an org picker;
   - else bid invitations only → `/bids`;
   - else → `/onboarding` (create org).
4. **Create org:** name required; slug suggested from the name (lower-case, `a-z0-9-`, 3–40
   chars), editable, unique (`409 slug_taken`). The creator becomes `owner`. A Free
   subscription is created. Optional fields at creation: default currency, unit system and
   country, used for project defaults.
5. **Invite:** email + role. `seats` is checked when sending (`402 limit_reached` with
   `limit: "seats"`). Pending invitations count towards seats. Inviting an email that is
   already a member returns `409 already_member`. Invitations expire after 14 days and can be
   resent (new token) or revoked.
6. **Accept:** the signed-in user's email must match the invitation email
   (case-insensitive). Otherwise the page explains it and offers "sign in with another account".
7. **Roles:** see `03-domain/permissions.md`. Changing one's own role is not allowed. The
   last owner can't be removed or demoted (`409 last_owner`).
8. **Remove member:** their project memberships in this org are removed. Their past actions
   stay in the audit log with their name.
9. **Delete org (owner):** type the org name to confirm. Status becomes `deleting`. Data is
   removed within 30 days (BR-52). Members are notified.

## Screens

- `/sign-in`, `/sign-up` (auth adapter pages), `/onboarding` (create org), `/invite/[token]`.
- `/{org}/settings/general`, `/{org}/settings/members` (members table: name, email, role,
  joined, last active; invitations table: email, role, sent, expires, resend/revoke).
- `/account` (name, locale, my orgs, leave org).
- Org switcher in the top bar.

## Edge cases

- A user invited to two orgs accepts both. Both appear in the switcher.
- An invitation is accepted after the org hit its seat limit (e.g. after a downgrade): accept
  still works, because the seat was counted when it was sent.
- An email change at the auth provider: matching is by `authSubject`, and the email is updated
  on the next `GET /me`.

## API

`GET /me`, `PATCH /me`, `GET /orgs`, `POST /orgs`, `GET /orgs/{orgId}`, `PATCH /orgs/{orgId}`,
`DELETE /orgs/{orgId}`, `GET /orgs/{orgId}/members`, `PATCH /orgs/{orgId}/members/{userId}`,
`DELETE /orgs/{orgId}/members/{userId}`, `GET /orgs/{orgId}/invitations`,
`POST /orgs/{orgId}/invitations`, `DELETE /orgs/{orgId}/invitations/{invitationId}`,
`POST /orgs/{orgId}/invitations/{invitationId}/resend`, `GET /invitations/{token}`,
`POST /invitations/{token}/accept`.

## Acceptance criteria

- [ ] A new user can sign up, create an org and land on its empty dashboard in under a minute.
- [ ] An invited user with a different email address cannot accept the invitation.
- [ ] Inviting beyond the seat limit returns `402` with `limit: "seats"`, and the UI shows the upgrade prompt.
- [ ] The last owner cannot leave or be demoted.
- [ ] A user in two orgs switches between them, and every request after the switch uses the new org.
- [ ] Every action above writes an audit event (`member.invited`, `member.joined`, `member.role_changed`, `member.removed`, `org.created`, `org.updated`).
