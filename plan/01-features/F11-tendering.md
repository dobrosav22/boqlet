# F11 Tendering

## Purpose

Turn an issued BoQ into priced offers. Split it into trade packages, invite contractors, let
them price in the browser or in Excel, compare side by side, award. This replaces email +
spreadsheets (P04).

## Roles

- **Firm** (project lead, estimator: create and run tenders; approver, lead: award).
- **Bidder** (contractor/subcontractor, free, global identity, see only what they were sent).

## Firm side

### 1. Create a tender
From an issued revision ("Tender this revision") or the project's Tenders tab:
name, revision (issued only), currency (default project), deadline (date, time, timezone),
instructions (markdown), attachments (PDF/DWG/any, ≤ 100 MB each, stored, scanned if
available), sealed (default on), allow partial offers (default off), share comparison with
guests (default off), **item texts from** (`textSystem`: the classification whose item numbers
and item texts bidders see, P14; default the revision's first classification). Status
`draft`. Checks `openTenders` when opening.

### 2. Packages
- **Build** a package from a selection (`PackageSelection`): pick code groups in any
  classification of the revision (e.g. "2.5 External walls" + "2.6 Windows"), families, or
  individual lines; exclude lines. `POST /tenders/{id}/packages/preview-selection` returns the
  lines it would contain and any **conflicts** with other packages (BR-41).
- **Quick start:** "One package per top-level group of [classification]". This creates
  packages from the groups, named after the group titles.
- **Unassigned lines** panel: lines in no package (they won't be priced). Shown as a count
  and a list. Not an error, but visible (BR-03).
- A package line's `code` and `description` come from the tender's `textSystem`: the item
  number and the filled item text, or the rule set's line text when the code has no text.
  Bidders price that text, so the draft package preview shows exactly what they will see.
- Package lines are frozen copies (`PackageLine`) taken when the tender opens or an
  addendum is made (BR-42). In `draft`, the package shows a live preview from the revision.

### 3. Invite bidders
Per package: add bidders by email + company name (+ contact name). Pick from **previous
bidders** of the org (address book built from past invitations). Checks `biddersPerPackage`.
One bidder can be invited to several packages, as separate invitations shown together on
their side. Invitations are sent when the tender opens, or immediately if it is already open.

### 4. Open
Preconditions: at least one package with at least one line and one invitation, deadline in
the future. Freezes package lines (addendum 0), sends invitation emails (tender name, firm,
deadline, link), status `open`.

### 5. While open
- **Status board:** per package × bidder: invited / viewed / declined (reason) / submitted
  (time), last activity. **Sealed:** no amounts (BR-44). Unsealed: totals visible.
- **Remind:** resend the invitation email to the selected bidders who haven't submitted.
- **Addendum:** when a new revision of the BoQ is issued, or the firm changes a package
  (lines, instructions, attachments, deadline): `POST /tenders/{id}/addenda {revisionId?, note, packageChanges?}`
  → re-snapshot affected packages (re-apply each package's selection to the new revision),
  supersede current offers on affected packages (BR-43), notify their bidders with the note
  and a summary of line changes (added/removed/quantity changed, from the run diff).
- **Extend deadline** (also after close, which reopens): bidders notified.
- **Close early:** only if every invited bidder has submitted or declined (otherwise
  confirmation needed). Automatic close at the deadline by the system.

### 6. Compare (after close; or live if unsealed)
`GET /packages/{id}/comparison`:
- **Columns:** package lines (ref, description, unit, qty) | per bidder: rate, amount |
  statistics: lowest rate, median rate, spread.
- **Totals row** per bidder. Ranking by total.
- **Flags:** missing rate on a line with quantity (red), rate deviating from the median by more
  than ±30% (setting per tender) (amber), lowest per line (bold), line notes from bidders
  (icon, hover).
- **Bidder column header:** company, submitted at, valid until, qualifications (expand),
  source (portal / Excel).
- **Normalisation (view only):** "fill missing rates with median" toggle to compare totals
  like-for-like. It is marked clearly and never saved into the offer.
- Filters: show only flagged lines, group by code.
- **Export** comparison to Excel (F12).

### 7. Award
Per package (approver, lead; tender `closed`): choose a submitted offer of the latest
addendum, optional note → package `awarded`. All bidders of the package are notified: the
winner "awarded", others "not awarded" (no other prices disclosed). When all packages are
awarded or cancelled, the tender becomes `awarded`. Award is audited. It is **not** a contract.
The text says "selected" in legal-neutral wording and the firm takes it from there.

## Bidder side (`/bids`)

1. **Invitation email** → link `/bid-invite/{token}` → sign in or sign up (any auth method
   of the adapter; email must match, or the token proves ownership of the email) → invitation
   linked to the user. The bidder's first sign-up asks only name and company.
2. **My tenders** (`/bids`): all invitations across firms: firm, tender, package, deadline
   (countdown), status. Sections: open, submitted, closed, awarded/not.
3. **Package page** (`/bids/{invitationId}`): firm name, tender name, instructions,
   attachments (download), deadline, package lines table (ref, description, unit, quantity;
   flagged lines show "quantity to be confirmed"), and for each line a **rate input**, an amount
   (computed live in the browser for display, recomputed by the backend), and a note. Totals.
   General notes, qualifications, valid-until date.
   - **Autosave draft** (`PUT /bids/{id}/offer`).
   - **Submit** (`POST /bids/{id}/offer/submit`), validation per BR rules: all rates for lines
     with quantity unless partial allowed.
   - **Withdraw** / **edit and re-submit** before the deadline.
   - **Decline** with an optional reason.
4. **Excel round-trip:** "Download package (xlsx)" gives a protected sheet with line ids in a
   hidden column and a rate column to fill in. "Upload priced file" → `import_offer` job →
   rates go into the draft, with a report (lines matched, unknown rows, invalid numbers) →
   bidder reviews → submit. The Excel never submits on its own.
5. **After addendum:** banner "The firm issued addendum 2: 6 lines changed. Please review and
   submit again." Draft prefilled with the previous rates by line key and unit (BR-43);
   changed lines highlighted.
6. **After close:** read-only. After award: outcome shown.

## Notifications (see F13)
Firm: offer submitted (unsealed: with total), bidder declined, deadline in 24 h with N
bidders not submitted, tender closed (with submission count). Bidder: invited, reminder,
addendum, deadline in 24 h (if not submitted), tender closed, awarded / not awarded.

## Edge cases

- A bidder email has no account and the bidder never signs up: they can still act on
  the invitation through the token link with a verified one-time code to email
  (passwordless), if the auth provider supports it. Otherwise sign-up is required. **Decide
  with the auth choice** (07-backend/decisions-to-make.md).
- Currency: one currency per tender. Bidders cannot change it.
- Rates with more decimals than the currency: stored as entered (up to 4 decimals). Amounts are
  rounded per BR-47.
- A package with 0 lines after an addendum (all its codes gone): the package is flagged and
  the firm must cancel or reselect before the addendum is sent.
- Deadline in the bidder's local timezone: shown in both the tender timezone and local time.

## API (firm)

`GET /projects/{projectId}/tenders`, `POST /projects/{projectId}/tenders`,
`GET /tenders/{tenderId}`, `PATCH /tenders/{tenderId}`, `POST /tenders/{tenderId}/open`,
`POST /tenders/{tenderId}/close`, `POST /tenders/{tenderId}/extend`,
`POST /tenders/{tenderId}/cancel`, `POST /tenders/{tenderId}/attachments`,
`DELETE /tender-attachments/{attachmentId}`, `GET /tenders/{tenderId}/packages`,
`POST /tenders/{tenderId}/packages`, `POST /tenders/{tenderId}/packages/preview-selection`,
`POST /tenders/{tenderId}/packages/from-groups`, `GET /packages/{packageId}`,
`PATCH /packages/{packageId}`, `DELETE /packages/{packageId}`, `GET /packages/{packageId}/lines`,
`GET /packages/{packageId}/invitations`, `POST /packages/{packageId}/invitations`,
`DELETE /bid-invitations/{invitationId}`, `POST /bid-invitations/{invitationId}/remind`,
`GET /tenders/{tenderId}/addenda`, `POST /tenders/{tenderId}/addenda`,
`GET /tenders/{tenderId}/status-board`, `GET /tenders/{tenderId}/unassigned-lines`, `GET /packages/{packageId}/comparison`,
`POST /packages/{packageId}/comparison/export`, `POST /packages/{packageId}/award`,
`GET /orgs/{orgId}/bidders` (address book).

## API (bidder)

`GET /bid-tokens/{token}`, `POST /bid-tokens/{token}/accept`,
`GET /bids`, `GET /bids/{invitationId}`, `GET /bids/{invitationId}/lines`,
`GET /bids/{invitationId}/attachments/{attachmentId}`, `POST /bids/{invitationId}/decline`,
`POST /bids/{invitationId}/reconsider`, `GET /bids/{invitationId}/offer`,
`PUT /bids/{invitationId}/offer`, `POST /bids/{invitationId}/offer/submit`,
`POST /bids/{invitationId}/offer/withdraw`, `GET /bids/{invitationId}/package.xlsx`,
`POST /bids/{invitationId}/offer/import`.

## Acceptance criteria

- [ ] "One package per top-level group" on the Duplex creates packages that cover every coded line exactly once, and unassigned lines are listed.
- [ ] With a `textSystem` that has item texts, bidders see the item numbers and filled item texts in the portal and in the package Excel, frozen at opening.
- [ ] A sealed tender exposes no rate or total to the firm before close, through any endpoint, export or notification (automated test over all firm endpoints).
- [ ] A bidder invited to package A gets `404` for package B's lines and any project endpoint.
- [ ] An Excel round-trip fills the draft with 100% of rates from a file filled in by an Excel user, and reports any rows that don't match.
- [ ] An addendum after a new revision supersedes affected offers, carries rates over by line key and unit, and notifies those bidders.
- [ ] The comparison shows lowest and median per line, missing rates and deviations beyond 30%, and totals that equal the sum of rounded amounts (BR-47).
- [ ] Award notifies every bidder of the package, and the tender becomes `awarded` when all packages are decided.
