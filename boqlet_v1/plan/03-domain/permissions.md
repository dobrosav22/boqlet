# Permissions

Kinds of principal (P28): **org users** (an org role, and a project role per project),
**public-link visitors** (no account, one share link), **platform admins** (the operator's
console only) and, with the pricing module, **vendor users** (reach only what firms send or
share with them). There are no logged-in guests. One user can be an org user and a vendor in
different contexts. Every signed-in principal has one active session (BR-54).

The backend enforces every rule here on every request. The frontend hides what the user may not
do, using `GET /me` and the `permissions` object returned with each project and BoQ. Hiding in
the UI is never the security boundary.

## Org roles

| Action | owner | admin | library_editor | member |
|---|---|---|---|---|
| Rename org, change settings (incl. `approvalRequired`, `fourEyes`, `publicLinksAllowed`, formats) | ✓ | ✓ | | |
| Billing, plan, see invoices | ✓ | | | |
| Delete org | ✓ | | | |
| Invite / remove members, change roles | ✓ | ✓ | | |
| Make someone owner | ✓ | | | |
| Create projects | ✓ | ✓ | ✓ | ✓ |
| See all projects | ✓ | ✓ | | |
| Library: view org presets | ✓ | ✓ | ✓ | ✓ |
| Library: create, edit, publish, archive org presets | ✓ | ✓ | ✓ | |
| Promote a decision to the company dictionary | ✓ | ✓ | ✓ | |
| Finish the setup wizard (F16) | ✓ | ✓ | ✓ | |
| See org usage | ✓ | ✓ | | |
| See org audit log | ✓ | ✓ | | |
| See and revoke every share link of the org | ✓ | ✓ | | |

An org must always have at least one owner. The last owner can't leave or be demoted.

## Project roles

Org owners and admins act as `lead` on every project. The creator of a project becomes its
`lead`. Project roles are given to org users only.

| Action | lead | estimator | approver | viewer |
|---|---|---|---|---|
| See project, models, BoQs (working and saved versions), explanations, viewer, exports | ✓ | ✓ | ✓ | ✓ |
| Edit project settings, defaults, archive | ✓ | | | |
| Manage project members | ✓ | | | |
| Create models, upload versions, edit scope | ✓ | ✓ | | |
| Create BoQs, edit inputs, generate runs | ✓ | ✓ | | |
| Answer questions (project decisions) | ✓ | ✓ | | |
| Edit lines (quantity, text, unit, section, order, exclude), add manual lines, import edits from Excel | ✓ | ✓ | | |
| Edit project-layer presets (project dictionary, patches) | ✓ | ✓ | | |
| Save version (approval off) | ✓ | ✓ | | |
| Submit for review (approval on) | ✓ | ✓ | | |
| Approve / request changes / save the approved version (approval on) | ✓ | | ✓ | |
| Confirm a BoQ | ✓ | | ✓² | |
| Reopen a confirmed BoQ | ✓ | | | |
| Create and edit share links (F18) | ✓ | ✓ | ✓ | |
| Revoke any share link of the project | ✓ | | ✓ | |
| Project audit log | ✓ | | ✓ | |

² Approvers confirm only when approval is on; otherwise confirming is the lead's.

Four-eyes (org setting `fourEyes`, plan feature `approvalWorkflow`, only with approval on): the
user who submitted a version cannot approve or save it, even as lead.

Members of the org with no project role and no admin rights don't see the project at all (it
isn't listed, and direct access returns `404`, not `403`, so its existence isn't revealed).

## Public-link visitors

No account. With a valid token they read, through `/public/shares/{token}/*`, only what the
link includes (F18, BR-56). Nothing else, and no writes.

## Platform admins

`User.platformRole = "admin"`. They reach only `/admin/*` (F19): metadata, counts, usage,
subscription and entitlement changes, notes, ending a user's session. They have no access to
org endpoints or project content by that role (BR-57). Non-admins get `404` on `/admin/*`.

## Pricing module (P36)

These rules exist only while the module is installed and on; the module enforces them in its
own Policy, on its own `/pricing/*` endpoints.

| Action | owner | admin | library_editor | member |
|---|---|---|---|---|
| See the vendor directory and vendors' shared price lists | ✓ | ✓ | ✓ | ✓ |
| Invite and edit vendors | ✓ | ✓ | ✓¹ | ✓¹ |
| Remove vendors | ✓ | ✓ | | |
| See org pricebooks | ✓ | ✓ | ✓ | ✓ |
| Edit org pricebooks | ✓ | ✓ | ✓ | ✓³ |
| Module settings | ✓ | ✓ | | |

¹ While `membersCanInviteVendors` is on (default). ³ While `membersCanEditPricebooks` is on (default off).

| Action | lead | estimator | approver | viewer |
|---|---|---|---|---|
| See the Pricing tab (estimate) and offer requests, offers, comparisons | ✓ | ✓ | ✓ | |
| Edit the estimate | ✓ | ✓ | | |
| Send, update, close offer requests; use offer rates in the estimate | ✓ | ✓ | ✓ | |

**Vendor users** reach only `/pricing/vendor/*`, `/pricing/vendor-invitations/*` and their own
pricebooks. A vendor link grants a firm nothing over the vendor except seeing the one price list
the vendor chose to share with it.

| Action | Vendor |
|---|---|
| Manage their own pricebooks and remembered matches | ✓ |
| Choose which price list each linked firm sees (or none) | ✓ |
| See an offer request's firm, name, message, deadline, attachments and its lines (current update) | ✓ |
| See other requests' lines, other vendors, other offers, models, viewer, explanations | ✗ |
| Create / edit / submit / withdraw their offer while the request is open; Excel round-trip; decline | ✓ |

## System actions

The system actor can: close offer requests at their deadline, expire invitations, retry jobs,
expire sessions, and write usage and audit events. System actions are audited with
`actorKind: "system"`.

## Errors

| Situation | Response |
|---|---|
| Not signed in | `401 unauthenticated` |
| Session ended by a sign-in elsewhere | `401 session_replaced` |
| Resource exists but the user may not know it (other org, project without access, module off) | `404 not_found` |
| Resource visible but the action is not allowed by role | `403 forbidden` with `{"required": "approver"}` |
| Allowed by role but blocked by state | `409` with a specific code (`revision_locked`, `boq_confirmed`, `invalid_transition`, `deadline_passed`) |
| Blocked by plan | `402 limit_reached` |
