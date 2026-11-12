# F11 Offer requests and offers (pricing module)

**Pricing module (P36): separate and removable.** Nothing in the core app depends on this
feature. It reads core data through the module boundary (`04-architecture/modules.md`) and
appears in core screens only through extension points. It is on only when the module is
enabled for the platform and the org's plan (P32). There are no formal tenders: no packages,
sealed bids or award (P34).

## Purpose

The core of pricing is the **pricebooks** (F20). An offer request is the extra step: "I know your
general prices, but have a look at this BoQ: what can you offer here?" The firm sends the whole
BoQ, or a part, to one or more of its vendors (F17) and gets priced offers back, filled from the
vendors' own pricebooks where they can. It compares offers side by side and, if wanted, takes
their rates into its own estimate (F20).

## Concepts

| Concept | Meaning | Code name |
|---|---|---|
| Offer request | What the firm sends: name, message, attachments, an optional deadline and the frozen lines it covers. | `OfferRequest` |
| Request line | A frozen copy of a BoQ line: position number, item number, item text, unit, quantity, notes. | `OfferRequestLine` |
| Update | A new frozen set of lines after the BoQ changed (update 0 is the first send). | `OfferRequest.currentUpdate` |
| Offer invitation | One vendor's invitation to one request. | `OfferInvitation` |
| Offer | A vendor's priced answer: a rate per line, notes, qualifications, valid until. | `Offer`, `OfferLine` |

## Firm side

### 1. Send

1. In the sheet (F06) the user selects lines, whole sections, the current filter result,
   elements picked in the 3D view (F07 §9), or "Whole BoQ". The module adds **Request offers**
   to the sheet's selection actions (extension point `sheet.selectionActions`).
2. The dialog: vendors (multi-select from the directory, F17, filtered by trade; "Invite a new
   vendor" inline); name (default "{BoQ name} – {first section title}"); message; attachments;
   optional deadline; item texts from (`textSystem`, P14, default the sheet's "Group by"
   classification); currency (default the project's); allow partial offers (default on).
3. **Send** reads the selected lines from the BoQ's current run through the core read interface
   and freezes them in the module's own tables, with position numbers (P30) and item texts
   (BR-40). The request opens and the vendors are notified (email + in-app). The working version
   or a saved version can be sent, unless the org setting `offersFromSavedVersionsOnly` is on
   (default off).

### 2. While open

- **Status per vendor:** invited / viewed / declined (reason) / submitted (time). Offers are
  visible to the firm as soon as they are submitted.
- **Remind** vendors who haven't answered.
- **Send update:** the module listens to the core event `run.completed`; when a BoQ's current run
  differs from a request's frozen lines, the request shows "The BoQ changed since this was sent"
  with **Send update**: lines are frozen again (update n+1), vendors get a summary (added /
  removed / quantity changed), their offers become drafts with rates carried over by line key
  and unit (BR-43), and they submit again.
- **Close** (or automatically at the deadline), **extend** the deadline (reopens), **cancel**.
- The sheet shows "sent to 3 vendors" on lines in open requests, through the extension point
  `sheet.lineBadges`.

### 3. Compare

`GET /pricing/offer-requests/{id}/comparison`:
- **Columns:** request lines (no., item text, unit, qty) | per vendor: rate, amount | lowest and
  median rate | **our estimate** (F20) when the BoQ has one.
- **Totals** per vendor, ranking by total.
- **Flags:** missing rate on a line with quantity, rate more than ±30% from the median (setting
  per request), lowest per line, vendor notes.
- **Normalisation (view only):** "fill missing rates with the median"; never saved.
- **Use these rates:** copy a vendor's rates (all, a section or one line) into the firm's
  estimate (F20), with the source "offer from {vendor}, {date}".
- Export the comparison to Excel (module export, F20 §5).

Choosing a contractor happens outside the app (P34).

## Vendor side (`/vendor`)

1. **Invitation:** email and in-app notification → `/vendor/requests/{invitationId}`. A vendor
   who isn't linked yet gets the vendor invitation first (F17 §2).
2. **Requests list** (`/vendor/requests`): every request from every linked firm: firm, name,
   deadline, status (new, viewed, submitted, declined, closed).
3. **Request page:** firm, message, attachments, deadline; lines (no., item text, unit,
   quantity; flagged lines show "quantity to be confirmed") with a rate input, the amount
   (shown live, recomputed by the backend) and a note.
   - **Fill from my pricebook** (F20 §3): lines with a remembered match (this vendor, this firm)
     are prefilled and marked; for any other line the vendor picks an item from their own
     pricebooks (search by text, unit, trade), and the choice is remembered for this firm.
     Matching is manual, never guessed (P33). Rates can always be typed.
   - General notes, qualifications, valid-until date. Autosave.
   - **Submit** (all lines with a quantity need a rate unless partial offers are allowed),
     **withdraw** or edit and re-submit while open, **decline** with an optional reason.
4. **Excel round-trip:** download the request as xlsx (protected, hidden line keys, rate and
   note columns open), fill in, upload → `import_offer` job → rates into the draft with a report
   → review → submit. Excel never submits by itself.
5. **After an update:** banner "The firm sent an update: 6 lines changed"; rates carried over by
   line key and unit; changed lines highlighted.
6. **After close:** read-only.

## Notifications (F13)

Registered by the module in the core notification registry (`pricing.*` kinds). Firm: offer
submitted (with total), vendor declined, deadline in 24 h with N vendors not answered, request
closed. Vendor: invited, reminder, update, deadline in 24 h (not submitted), request closed.

## Edge cases

- A vendor without an account signs up from the invitation link (name, company); with a
  passwordless provider, a one-time code to the email is enough (07-backend D1).
- One currency per request. A vendor pricebook in another currency can still be used: the
  picked rate is converted with an exchange rate the vendor enters once per request.
- Rates keep up to 4 decimals; amounts are rounded to the currency's minor units (BR-47).
- Two requests may contain the same line; each request is independent.
- The module is switched off for the org: open requests stay readable to the vendors, the
  firm's screens are hidden, nothing new can be sent (P32).

## API (firm), all in `openapi-pricing.yaml`

`POST /pricing/boqs/{boqId}/offer-requests`, `GET /pricing/projects/{projectId}/offer-requests`,
`GET /pricing/offer-requests/{offerRequestId}`, `PATCH /pricing/offer-requests/{offerRequestId}`,
`POST /pricing/offer-requests/{offerRequestId}/updates`, `POST /pricing/offer-requests/{offerRequestId}/close`,
`POST /pricing/offer-requests/{offerRequestId}/extend`, `POST /pricing/offer-requests/{offerRequestId}/cancel`,
`GET /pricing/offer-requests/{offerRequestId}/lines`, `GET /pricing/offer-requests/{offerRequestId}/invitations`,
`POST /pricing/offer-requests/{offerRequestId}/invitations`, `POST /pricing/offer-invitations/{invitationId}/remind`,
`DELETE /pricing/offer-invitations/{invitationId}`, `POST /pricing/offer-requests/{offerRequestId}/attachments`,
`GET /pricing/offer-requests/{offerRequestId}/comparison`, `POST /pricing/offer-requests/{offerRequestId}/comparison/export`.

## API (vendor)

`GET /pricing/vendor/requests`, `GET /pricing/vendor/requests/{invitationId}`,
`GET /pricing/vendor/requests/{invitationId}/lines`, `POST /pricing/vendor/requests/{invitationId}/decline`,
`GET /pricing/vendor/requests/{invitationId}/offer`, `PUT /pricing/vendor/requests/{invitationId}/offer`,
`POST /pricing/vendor/requests/{invitationId}/offer/fill`, `POST /pricing/vendor/requests/{invitationId}/offer/submit`,
`POST /pricing/vendor/requests/{invitationId}/offer/withdraw`, `GET /pricing/vendor/requests/{invitationId}/request.xlsx`,
`POST /pricing/vendor/requests/{invitationId}/offer/import`.

## Acceptance criteria

- [ ] An estimator selects two sections in the sheet, sends them to two vendors with no deadline, and each vendor sees exactly those lines (and nothing else of the firm) within a minute.
- [ ] A vendor with remembered matches for this firm opens a request and "Fill from my pricebook" prefills those lines; other lines stay empty until the vendor picks or types a rate.
- [ ] After the BoQ changes, "Send update" re-freezes the lines, notifies the vendors and carries their rates over by line key and unit.
- [ ] The comparison shows every vendor's rates, totals, lowest and median per line and the firm's estimate; "Use these rates" copies them into the estimate with the source shown.
- [ ] An offer Excel filled in LibreOffice and in Excel imports with 100% matched lines.
