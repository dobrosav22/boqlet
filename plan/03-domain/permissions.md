# Permissions

Three kinds of principal: **org members** (with an org role), **project participants** (a
member or guest with a project role), and **bidders** (reach only their invitations). One
user can be all three in different contexts.

The backend enforces every rule here on every request. The frontend hides what the user may not
do, using `GET /me` and the `permissions` object returned with each project, BoQ and tender.
Hiding in the UI is never the security boundary.

## Org roles

| Action | owner | admin | library_editor | member |
|---|---|---|---|---|
| Rename org, change settings | ✓ | ✓ | | |
| Billing, plan, see invoices | ✓ | | | |
| Delete org | ✓ | | | |
| Invite / remove members, change roles | ✓ | ✓ | | |
| Make someone owner | ✓ | | | |
| Create projects | ✓ | ✓ | ✓ | ✓ |
| See all projects | ✓ | ✓ | | |
| Library: view org presets | ✓ | ✓ | ✓ | ✓ |
| Library: create, edit, publish, archive org presets | ✓ | ✓ | ✓ | |
| Promote a decision to the company dictionary | ✓ | ✓ | ✓ | |
| See org usage | ✓ | ✓ | | |
| See org audit log | ✓ | ✓ | | |

An org must always have at least one owner. The last owner can't leave or be demoted.

## Project roles

Org owners and admins act as `lead` on every project. The creator of a project becomes its
`lead`.

| Action | lead | estimator | approver | viewer | guest |
|---|---|---|---|---|---|
| See project, models, versions | ✓ | ✓ | ✓ | ✓ | |
| Edit project settings, defaults, archive | ✓ | | | | |
| Manage project members and guests | ✓ | | | | |
| Create models, upload versions, edit scope | ✓ | ✓ | | | |
| Create BoQs, edit inputs, generate runs | ✓ | ✓ | | | |
| Answer questions (project decisions) | ✓ | ✓ | | | |
| Overrides and manual lines | ✓ | ✓ | | | |
| Edit project-layer presets (project dictionary, patches) | ✓ | ✓ | | | |
| See draft / in-review / approved revisions | ✓ | ✓ | ✓ | | |
| Submit for review | ✓ | ✓ | | | |
| Approve / request changes | ✓ | | ✓ | | |
| Issue | ✓ | | ✓ | | |
| Start new revision | ✓ | ✓ | | | |
| See issued revisions, their exports and viewer | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create, edit, open, close tenders; invite bidders | ✓ | ✓ | | | |
| See offers and comparison | ✓ | ✓ | ✓ | | shared only |
| Award | ✓ | | ✓ | | |
| Project audit log | ✓ | | ✓ | | |

Four-eyes (org setting, plan feature): when on, the user who submitted a revision cannot
approve or issue it, even as lead.

Guests: see only issued revisions, and tender comparisons explicitly shared with them
(`Tender.sharedWithGuests`, default false). Guests never see questions, decisions, drafts, the
calculation log or bidder identities unless shared.

Members of the org with no project role and no admin rights don't see the project at all (it
isn't listed, and direct access returns `404`, not `403`, so its existence isn't revealed).

## Bidders

A bidder reaches only `/bids/*` endpoints. With a valid invitation (accepted by an account
whose email matches, or verified by the emailed link) they can:

| Action | Bidder |
|---|---|
| See tender name, firm name, deadline, instructions, attachments | ✓ |
| See their package's lines (latest addendum) | ✓ |
| See other packages, other bidders, other offers | ✗ |
| See the model, viewer, trace, codes other than the package code column | ✗ |
| Create / edit / submit / withdraw their offer before the deadline | ✓ |
| Download package Excel; upload a priced Excel | ✓ |
| Decline with a reason | ✓ |
| See award outcome for their package (won / not won) | ✓ (no other bidders' prices) |

Several people from the same contractor company can price one invitation only if the
invitation is forwarded to them by the firm (a second invitation with the same company name).
Shared bidder company accounts are later work.

## System actions

The system actor can: close tenders at the deadline, expire invitations, retry jobs, and
write usage and audit events. System actions are audited with `actorKind: "system"`.

## Errors

| Situation | Response |
|---|---|
| Not signed in | `401 unauthenticated` |
| Resource exists but the user may not know it (other org, project without access) | `404 not_found` |
| Resource visible but the action is not allowed by role | `403 forbidden` with `{"required": "approver"}` |
| Allowed by role but blocked by state | `409` with a specific code (`revision_locked`, `invalid_transition`, `deadline_passed`) |
| Blocked by plan | `402 limit_reached` |
