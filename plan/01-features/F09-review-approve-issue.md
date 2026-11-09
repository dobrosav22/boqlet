# F09 Versions, confirmation, optional approval, audit

## Purpose

A BoQ is a living document while the design develops, until the firm says it is done (P29).
Along the way people need fixed points they can send, compare and go back to, and firms that
want a formal check before something leaves the office can switch one on. Nothing is rigid by
default.

## The model in one paragraph

Every BoQ always has a **working version**: editable, regenerated as models change (internally
a `BoqRevision` in `draft`). **Save version** locks a snapshot with a label (A, B, C…) and a
note, and work continues at once in a new working version carried over from it. **Confirm**
marks the whole BoQ as done: it saves a final version if anything changed and makes the BoQ
read-only; **Reopen** makes it workable again. Firms that want review and approval before a
version is saved switch on `approvalRequired`; everyone else never sees those steps. Archiving
a **project** (F02) is separate: it makes the whole project read-only and stops it counting as
active.

## Behaviour

1. **Working version.** Always editable by leads and estimators (F06). Shown as "Working" in
   the header, with the last saved version's label beside it ("Working · last saved B").
2. **Save version** (lead, estimator; when approval is on, see §4). Dialog: label (next
   letter, editable), note, the **not in the models** reminder (P15, BR-12) with the manual-line
   count and the tick "I have added the work the models don't contain". Needs a finished run
   that reflects the current inputs, decisions and edits (`409 not_ready` otherwise, with the
   reason). Blocking questions don't prevent saving, but the dialog lists them and the saved
   version carries a "3 questions open" badge (flexible by design, P29).
   On save, the backend freezes the run id, a copy of the line edits and manual lines, the
   position numbers (P30), the estimate if there is one (F20), and starts the Excel export with
   the label and note in the header. The revision becomes `issued` (shown as "Saved"), and a new
   `draft` revision is created at once with the same inputs (`basedOnRevisionId` = the saved
   one). Line edits live on the BoQ and simply continue.
3. **Saved versions** (Versions tab): label, note, who, when, line count, badge for open
   questions; open read-only (sheet, viewer, explanation, estimate), frozen Excel download,
   compare with any other version or the working one (F08), share (F18), request offers on it
   (F11).
4. **Approval (optional)**, org setting `approvalRequired` (owner, admin; default off; plan
   feature `approvalWorkflow`):
   - "Save version" becomes **Submit for review**: pick reviewers (leads and approvers), message.
     Revision → `in_review`; reviewers notified.
   - **Review screen:** the sheet read-only, the change report against the last saved version
     first, the questions summary, every line edit with its reason, manual lines, warnings.
     Comments per line or overall.
   - **Request changes** (comment required) → back to `draft`. **Approve** → `approved`.
     **Save** (approver or lead) → `issued` as in §2. With `fourEyes` on, the submitter cannot
     approve or save their own submission.
   - Any edit while `in_review` or `approved` warns, then returns the revision to `draft` and
     tells the reviewers the review was withdrawn (BR-23).
5. **Confirm BoQ** (lead; with approval on, an approver or lead): "Mark this BoQ as done".
   Saves a final version first if the working version differs from the last saved one (same
   dialog as §2; with approval on, the last saved version must already be approved and saved).
   The BoQ becomes `confirmed`: read-only for everyone, the working version is closed, the
   project overview shows it as done, open offer requests can still be answered and compared.
6. **Reopen BoQ** (lead): reason required, audited; a new working version is created from the
   last saved one. Confirmation is never a contract lock; it is the firm's own "done".
7. **Archive project** (F02 §7): every BoQ in it becomes read-only, confirmed or not.

## Audit log

Append-only `AuditEvent` for every change of data (BR-51). Visible:
- **project audit** (`/{org}/projects/{p}/activity`, leads and approvers): filter by actor,
  action, entity, date;
- **org audit** (`/{org}/settings/audit`, owner and admin), retention by plan.

Action names (minimum set):
`org.created`, `org.updated`, `member.invited`, `member.joined`, `member.role_changed`,
`member.removed`, `session.replaced`, `project.created`, `project.updated`, `project.archived`,
`project_member.added`, `project_member.removed`, `model.created`, `model.updated`,
`model_version.uploaded`, `model_version.ready`, `model_version.failed`, `boq.created`,
`boq.confirmed`, `boq.reopened`, `revision.created`, `revision.inputs_changed`, `run.created`,
`run.finished`, `decision.set`, `decision.cleared`, `decision.promoted`, `override.set`,
`override.removed`, `manual_item.added`, `manual_item.changed`, `manual_item.removed`,
`revision.submitted`, `revision.changes_requested`, `revision.approved`, `revision.reopened`,
`version.saved`, `export.created`, `export.downloaded`, `edits.imported`, `preset.created`,
`preset_version.published`, `preset.archived`, `share_link.created`, `share_link.revoked`,
`vendor.invited`, `vendor.linked`, `vendor.removed`, `pricebook.changed`, `estimate.changed`,
`offer_request.sent`, `offer_request.updated`, `offer_request.closed`, `offer_invitation.viewed`,
`offer_invitation.declined`, `offer.submitted`, `offer.withdrawn`, `subscription.changed`,
`setup.completed`.

## API

`POST /revisions/{revisionId}/issue` (save version), `POST /revisions/{revisionId}/submit`,
`POST /revisions/{revisionId}/request-changes`, `POST /revisions/{revisionId}/approve`,
`POST /revisions/{revisionId}/reopen` (withdraw a review), `POST /revisions/{revisionId}/comments`,
`POST /boqs/{boqId}/confirm`, `POST /boqs/{boqId}/reopen`, `GET /boqs/{boqId}/revisions`,
`GET /projects/{projectId}/audit`, `GET /orgs/{orgId}/audit`.

## Acceptance criteria

- [ ] With approval off, "Save version" from the working version locks a labelled snapshot and work continues in a new working version without any other step.
- [ ] A saved version stays byte-identical (sheet, position numbers, Excel) while the working version changes.
- [ ] With approval on, Save is replaced by Submit → Approve → Save, and with four-eyes on the submitter cannot approve (`403` with `reason: "four_eyes"`).
- [ ] Confirming a BoQ makes every write to it return `409 boq_confirmed`, including for an owner; Reopen (with a reason) restores a working version and is audited.
- [ ] Every transition writes an audit event with actor and time, visible in the project activity.
