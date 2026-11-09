# F13 Notifications

## Channels

- **In-app, live:** a bell with an unread count. Toasts for the user's own job results. Pushed
  over the SSE stream `GET /events`.
- **Email:** only for moments someone must act or would want to know while away.
- Per-user preferences: email on/off per category (not per event). In-app is always on.

## Events

| Kind | To | In-app | Email (default) |
|---|---|---|---|
| `job.succeeded` / `job.failed` (parse, run, preview, export, import) | the job's creator | toast + bell | parse/run failed: yes; others: no |
| `model_version.ready` | uploader | ✓ | yes if parse took > 2 min |
| `boq.new_version_available` | estimators and leads of the project | ✓ | no |
| `run.needs_input` | run creator | ✓ | no (they are usually looking) |
| `version.saved` | project members | ✓ | no |
| `boq.confirmed` / `boq.reopened` | project members | ✓ | yes |
| `revision.review_requested` (approval on) | chosen reviewers | ✓ | yes |
| `revision.changes_requested` / `revision.approved` (approval on) | submitter | ✓ | yes |
| `revision.review_withdrawn` (approval on) | reviewers | ✓ | no |
| `member.invited` (org) | invitee (email only) | — | yes |
| `project_member.added` | the user | ✓ | yes |
| `session.revoked` | the replaced session (SSE only) | signed-out message | no |
| `vendor.invited` | vendor (email only) | — | yes |
| `vendor.linked` | the inviting member | ✓ | no |
| `offer_request.offer_submitted` | request sender + project leads | ✓ (with total) | no |
| `offer_request.vendor_declined` | request sender | ✓ | no |
| `offer_request.deadline_soon` (24 h, with not-answered count) | request sender | ✓ | yes |
| `offer_request.closed` | request sender | ✓ | no |
| `offer_invitation.invited` | vendor | ✓ | yes |
| `offer_invitation.reminder` | vendor | ✓ | yes |
| `offer_invitation.updated` | vendor | ✓ | yes |
| `offer_invitation.deadline_soon` (24 h, not submitted) | vendor | ✓ | yes |
| `offer_invitation.closed` | vendor | ✓ | no |
| `limit.near` (80% of a limit) / `limit.reached` | owner, admins | ✓ | yes |

## Behaviour

- Notification rows: `{kind, params, entity, url}`. The frontend renders the text from i18n
  messages by `kind` with `params` (P07, P35). The backend never stores rendered text except in
  sent emails, which are rendered in the recipient's language.
- Emails are rendered by the backend from templates per kind and language, with one clear call
  to action linking into the app. Sent through an email provider adapter (decision in 07-backend).
- **Batching:** several `offer_request.offer_submitted` within 10 minutes merge into one bell item.
- Vendor and offer events exist only while the pricing module is on (P32).

## API

`GET /notifications` (paged, `unreadOnly`), `POST /notifications/{id}/read`,
`POST /notifications/read-all`, `GET /me/notification-preferences`,
`PUT /me/notification-preferences`, SSE `GET /events` (event types: `job.progress`,
`job.finished`, `notification.created`, `entity.changed`, `boq.line_edited`, `boq.presence`,
`session.revoked`).

## Acceptance criteria

- [ ] A run finishing in another tab shows a toast and updates the open BoQ page within 2 s.
- [ ] A vendor gets the offer request by bell and email with a working deep link.
- [ ] Turning off email for "Offers" stops offer emails and keeps bell notifications.
