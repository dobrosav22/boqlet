# F13 Notifications

## Channels

- **In-app, live:** a bell with an unread count. Toasts for the user's own job results. Pushed
  over the SSE stream `GET /events`.
- **Email:** only for moments someone must act or would want to know while away.
- Per-user preferences: email on/off per category (not per event). In-app is always on.

## Events

| Kind | To | In-app | Email (default) |
|---|---|---|---|
| `job.succeeded` / `job.failed` (parse, run, preview, export) | the job's creator | toast + bell | parse/run failed: yes; others: no |
| `model_version.ready` | uploader | ✓ | yes if parse took > 2 min |
| `boq.new_version_available` | estimators and leads of the project | ✓ | no |
| `run.needs_input` | run creator | ✓ | no (they are usually looking) |
| `revision.review_requested` | chosen reviewers | ✓ | yes |
| `revision.changes_requested` | submitter | ✓ | yes |
| `revision.approved` | submitter | ✓ | yes |
| `revision.issued` | project members | ✓ | yes |
| `revision.review_withdrawn` | reviewers | ✓ | no |
| `member.invited` (org) | invitee (email only) | — | yes |
| `project_member.added` | the user | ✓ | yes |
| `tender.offer_submitted` | tender creator + project leads | ✓ (total only if unsealed) | no |
| `tender.bidder_declined` | tender creator | ✓ | no |
| `tender.deadline_soon` (24 h, with not-submitted count) | tender creator | ✓ | yes |
| `tender.closed` | tender creator + leads | ✓ | yes |
| `bid.invited` | bidder | ✓ | yes |
| `bid.reminder` | bidder | ✓ | yes |
| `bid.addendum` | affected bidders | ✓ | yes |
| `bid.deadline_soon` (24 h, not submitted) | bidder | ✓ | yes |
| `bid.awarded` / `bid.not_awarded` | package bidders | ✓ | yes |
| `limit.near` (80% of a limit) / `limit.reached` | owner, admins | ✓ | yes |

## Behaviour

- Notification rows: `{kind, params, entity, url}`. The frontend renders the text from i18n
  messages by `kind` with `params` (P07). The backend never stores rendered English text
  except in sent emails.
- Emails are rendered by the backend from templates per kind (i18n-ready, English only in v1),
  with one clear call to action linking into the app. Sent through an email provider adapter
  (decision in 07-backend).
- **Batching:** several `tender.offer_submitted` within 10 minutes merge into one bell item.
- **Sealed tenders:** no amounts in any notification before close (BR-44).

## API

`GET /notifications` (paged, `unreadOnly`), `POST /notifications/{id}/read`,
`POST /notifications/read-all`, `GET /me/notification-preferences`,
`PUT /me/notification-preferences`, SSE `GET /events` (event types: `job.progress`,
`job.finished`, `notification.created`, `entity.changed`).

## Acceptance criteria

- [ ] A run finishing in another tab shows a toast and updates the open BoQ page within 2 s.
- [ ] A review request reaches the reviewer by bell and email with a working deep link.
- [ ] Turning off email for "Tenders" stops tender emails and keeps bell notifications.
