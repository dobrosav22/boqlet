# F20 Pricebooks and pricing (pricing module)

**Pricing module (P36): separate and removable.** Nothing in the core app depends on this
feature. It reads core data through the module boundary (`04-architecture/modules.md`) and
appears in core screens only through extension points. It is on only when the module is
enabled for the platform and the org's plan (P32).

## Purpose

Firms and vendors keep their own prices in **pricebooks** and pull from them instead of typing
rates again for every BoQ (P33). A firm prices its own BoQ (an **estimate**, e.g. a priced BoQ
for a cost check or permit) on a **pricing screen** that is separate from building the BoQ
from the models: it never changes quantities and never touches the IFC → BoQ flow. Vendors
price offer requests (F11) the same way, from their own pricebooks.

We supply no market prices: every price in the app was entered or imported by a firm or a
vendor.

## Concepts

| Concept | Meaning | Code name |
|---|---|---|
| Pricebook | A named list of priced items owned by an org or a vendor, in one currency. | `Pricebook` |
| Pricebook item | Ref (the owner's own number), description, unit, rate, trade/tags, price date, notes. | `PricebookItem` |
| Shared price list | A vendor pricebook shown to one linked firm (F17). | `VendorLink.sharedPricebookId` |
| Estimate | The firm's priced view of one BoQ: a rate per line, its source, totals. | `Estimate`, `EstimateLine` |
| Remembered match | "For this item, use that pricebook item": saved when a person picks a price, reused to prefill next time. | `PriceMatch` |

## Behaviour

### 1. Pricebooks (firm: `/{org}/pricing/pricebooks`; vendor: `/vendor/pricebooks`)

- A list of pricebooks (name, currency, items, last updated). An org or vendor may keep several
  ("2026 general", "Belgrade region", "Firm X special prices").
- **Editor:** a spreadsheet-like table (virtualised): ref, description, unit, rate, trade, price
  date (set automatically when the rate changes, editable), notes. Add, edit, delete, bulk
  edit (e.g. "+5% on the selection", "set price date"), search and filter by trade and unit.
  Every rate change keeps the previous rate and date in the item's history.
- **Excel:** download the pricebook (or an empty template) as xlsx, edit, upload back: the engine
  reads it (read-only, data-only), returns the changes (added, changed, removed items) and
  problems by row and column for review before anything is saved (same pattern as F10 §14).
- **Copy** a pricebook (for a firm-specific list or a new year).
- Who edits: firm pricebooks: owner, admin, library editor (setting to allow members too);
  vendor pricebooks: the vendor.

### 2. Pricing a BoQ (BoQ workspace › Pricing tab)

A separate screen, opened on purpose; the Sheet tab stays quantities-only. The tab is added by
the module through the extension point `boq.workspaceTabs`; the estimate reads lines and
quantities through the core read interface and stores nothing in core tables.
- Columns: no. (P30), item text, unit, quantity (read-only, from the BoQ), **rate**, amount,
  **source** (pricebook and item ref, or "offer from {vendor}", or "manual"), price date.
  Section subtotals and a grand total; an optional tax percentage shows the total including tax.
- **Fill remembered prices:** every line with a remembered match (§3) gets its rate from the
  matched item, marked "remembered". Nothing else is filled automatically.
- **Pick a price** for a line: a search over the org's own pricebooks and every price list its
  vendors share with it, filtered by default to the line's unit, with text search and trade
  filter. Each result shows the owner (own or vendor name), ref, description, unit, rate and
  price date. Picking sets the rate and remembers the match. Matching is manual, never guessed
  (P33).
- **Type a rate** (source "manual"), **use offer rates** from a compared offer (F11 §3), or
  **clear**.
- **Currency:** the estimate uses the project currency. A price from a pricebook in another
  currency needs an exchange rate, entered once per currency on the estimate and shown with
  the totals.
- **Stale prices:** a price date older than a set age (org setting, default 12 months) is
  flagged.
- **Follows the BoQ:** the estimate is matched to lines by line key. Quantity changes recompute
  amounts at once; new lines appear unpriced (flagged, counted in the header "4 lines without a
  price"); removed lines leave the estimate. The module listens to the core event
  `version.saved` and freezes its own copy of the estimate for that version (F09 knows nothing
  about estimates).
- **Export:** the priced BoQ as Excel (§5).

### 3. Remembered matches

- **Firm:** keyed by the line's item number in the org's grouping classification plus unit
  (stable across projects); for a line without an item number, by its normalised line text plus
  unit. Value: the pricebook item picked. Shared by everyone in the org, across projects.
- **Vendor:** the same key, kept per firm (the firm's item numbers are the firm's), pointing to
  the vendor's own pricebook item. Used by "Fill from my pricebook" on offer requests (F11).
- A remembered match whose pricebook item was deleted is dropped silently from prefill and
  listed in the pricebook's "matches pointing nowhere" view for cleanup.
- Matches can be reviewed and removed (Pricebooks › Remembered matches).

### 4. Vendors' price lists seen by a firm

From the vendor directory (F17) a firm opens the list a vendor shares with it: read-only,
searchable, with price dates. These lists appear in "Pick a price" next to the firm's own
pricebooks. The firm never sees a vendor's other lists.

### 5. Exports (the module's own)

- **Priced BoQ (estimate):** the core BoQ workbook layout (F12) with rate and amount filled and a
  "Price sources" sheet. Produced by the module: it asks the core for the BoQ export data and
  adds its columns; the core export knows nothing about prices.
- **Offer comparison** (F11 §3): lines × vendors with rates, amounts, flags, totals.
- **Offer request xlsx** for vendors and its import (F11 vendor side §4).
- **Pricebook xlsx** template and import (§1).

## Permissions

| Action | lead | estimator | approver | viewer |
|---|---|---|---|---|
| See the Pricing tab and estimates | ✓ | ✓ | ✓ | |
| Edit an estimate (pick, type, use offer rates) | ✓ | ✓ | | |

Firm pricebooks: see all org members; edit owner, admin, library editor (plus members when the
org allows it).

## Edge cases

- Units differ (pricebook in m², line in m³): the pick search hides it unless "show all units"
  is ticked; picking across units needs a confirmation and is flagged on the line.
- A shared price list becomes unshared: rates already in an estimate stay, with their source
  shown as "{vendor} (no longer shared)".
- A BoQ is confirmed (F09): its estimate becomes read-only with it.
- The module is switched off: Pricing tabs and pricebooks are hidden; data is kept.

## API

Firm: `GET /pricing/orgs/{orgId}/pricebooks`, `POST /pricing/orgs/{orgId}/pricebooks`,
`GET /pricing/pricebooks/{pricebookId}`, `PATCH /pricing/pricebooks/{pricebookId}`,
`DELETE /pricing/pricebooks/{pricebookId}`, `POST /pricing/pricebooks/{pricebookId}/copy`,
`GET /pricing/pricebooks/{pricebookId}/items`, `POST /pricing/pricebooks/{pricebookId}/items/batch`,
`GET /pricing/pricebooks/{pricebookId}/template.xlsx`, `POST /pricing/pricebooks/{pricebookId}/import`,
`GET /pricing/orgs/{orgId}/price-search`, `GET /pricing/orgs/{orgId}/price-matches`,
`DELETE /pricing/price-matches/{matchId}`, `GET /pricing/boqs/{boqId}/estimate`, `PUT /pricing/boqs/{boqId}/estimate`
(settings: tax, exchange rates), `POST /pricing/boqs/{boqId}/estimate/lines/batch` (set or clear rates),
`POST /pricing/boqs/{boqId}/estimate/fill-remembered`, `POST /pricing/boqs/{boqId}/estimate/export`.
Vendor: `GET /pricing/vendor/pricebooks`, `POST /pricing/vendor/pricebooks`, and the same pricebook endpoints
(ownership checked), `GET /pricing/vendor/price-search`, `GET /pricing/vendor/price-matches`.

## Acceptance criteria

- [ ] A firm imports a 500-item pricebook from Excel, reviews the proposed items and saves; a later upload with 3 changed rates shows exactly those 3 changes.
- [ ] On the Duplex BoQ, picking prices for 10 lines and then opening a second project with the same item numbers prefills those 10 lines as "remembered".
- [ ] "Pick a price" shows the firm's own pricebooks and only the price lists vendors share with this firm, filtered to the line's unit.
- [ ] Changing a quantity in the BoQ (a new run or a line edit) updates the amount on the Pricing tab; new lines appear as "without a price".
- [ ] No quantity, line or classification changes when an estimate is edited (BR-02 extended to pricing).
