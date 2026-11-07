# F09 Review, approval, issue, audit

## Purpose

A BoQ goes into contracts. It needs an accountable path from draft to issued, a lock, and a
trail of who did what.

## Behaviour

1. **Submit for review** (estimator, lead): preconditions in BR-22. Dialog: pick reviewers
   (project approvers/leads; at least one), optional message. The dialog also shows the
   **not in the models** reminder (P15, BR-12) with the revision's manual-line count and a
   checkbox "I have added the work the models don't contain" that must be ticked to submit.
   The tick is stored on the submission (`revision.submitted` audit event, `notModelledConfirmed:
   true`). It is a reminder, not a check of content. Revision → `in_review`,
   notification `revision.review_requested` to reviewers.
2. **Review screen:** the sheet read-only, the change report against the previous issued
   revision (if any) opened first, the questions summary (answered decisions, informative ones
   left), overrides list (every override with reason), manual lines list, warnings.
   Reviewers can comment per line (stored as `reviewComments` on the revision with `lineKey`)
   or overall.
3. **Request changes** (approver, lead): comment required → `draft`, notification to the
   submitter.
4. **Approve** (approver, lead; four-eyes: not the submitter) → `approved`. Optional comment.
5. **Issue** (approver, lead; four-eyes applies): dialog shows label (Rev B), date, issue note,
   and "this cannot be undone". On confirm: backend freezes (run id, copy of adjustments,
   Excel export job with the revision label and issue note in the header), sets `issued`,
   `boq.latestIssuedRevisionId`, notifies project members, and (if a tender is open on an
   earlier revision of this BoQ) offers to create an addendum (F11).
6. **Reopen** (any edit on an `in_review`/`approved` revision): warning dialog, then `draft`.
   Reviewers are notified that the review was withdrawn.
7. **Issued revision page:** read-only sheet, viewer, change report, frozen Excel download,
   issue metadata (who, when, note), review history.

## Audit log

Append-only `AuditEvent` for every change of data (BR-51). Visible:
- **project audit** (`/{org}/projects/{p}/activity`, lead and approver): filter by actor,
  action, entity, date;
- **org audit** (`/{org}/settings/audit`, owner and admin), retention by plan.

Action names (minimum set):
`org.created`, `org.updated`, `member.invited`, `member.joined`, `member.role_changed`,
`member.removed`, `project.created`, `project.updated`, `project.archived`,
`project_member.added`, `project_member.removed`, `model.created`, `model.updated`,
`model_version.uploaded`, `model_version.ready`, `model_version.failed`, `boq.created`,
`revision.created`, `revision.inputs_changed`, `run.created`, `run.finished`, `decision.set`,
`decision.cleared`, `decision.promoted`, `override.set`, `override.removed`,
`manual_item.added`, `manual_item.changed`, `manual_item.removed`, `revision.submitted`,
`revision.changes_requested`, `revision.approved`, `revision.reopened`, `revision.issued`,
`export.created`, `export.downloaded`, `preset.created`, `preset_version.published`,
`preset.archived`, `tender.created`, `tender.opened`, `tender.addendum`, `tender.closed`,
`tender.extended`, `tender.cancelled`, `bid_invitation.sent`, `bid_invitation.viewed`,
`bid_invitation.declined`, `offer.submitted`, `offer.withdrawn`, `package.awarded`,
`subscription.changed`.

## API

`POST /revisions/{revisionId}/submit`, `POST /revisions/{revisionId}/request-changes`,
`POST /revisions/{revisionId}/approve`, `POST /revisions/{revisionId}/issue`,
`POST /revisions/{revisionId}/reopen`, `POST /revisions/{revisionId}/comments`,
`GET /projects/{projectId}/audit`, `GET /orgs/{orgId}/audit`.

## Acceptance criteria

- [ ] Submit is impossible while blocking questions or pending changes exist (button disabled with the reason; API `409 not_ready`).
- [ ] With four-eyes on, the submitter cannot approve or issue (`403` with `reason: "four_eyes"`).
- [ ] After issue, every write touching that revision returns `409 revision_locked`, including for an owner.
- [ ] The frozen Excel of an issued revision is byte-identical on every download.
- [ ] Every transition writes an audit event with actor and time, visible in the project activity.
