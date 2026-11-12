# F17 Vendors (pricing module)

**Pricing module (P36): separate and removable.** Nothing in the core app depends on this
feature. It reads core data through the module boundary (`04-architecture/modules.md`) and
appears in core screens only through extension points. It is on only when the module is
enabled for the platform and the org's plan (P32).

## Purpose

A firm works with a circle of contractors and suppliers. They get **vendor accounts**, linked
to every org that invited them. A vendor keeps their own **pricebooks** (F20) and decides which
price list each firm may see; firms use those prices in their own estimates and send offer
requests on a BoQ (F11). Vendors see only what is sent to them and nothing else of a firm
(BR-46, BR-55).

## Concepts

| Concept | Meaning | Code name |
|---|---|---|
| Vendor account | A user who prices for firms: company name, trades, contact. Free, never a seat. One user can be an org member and a vendor at once; the vendor area is separate. | `User.vendorProfile` |
| Vendor link | A vendor in one org's directory: invited → active → removed. A vendor can be linked to many orgs; each org sees only its own link. | `VendorLink` |
| Shared price list | The pricebook a vendor shows to one linked firm (or none). | `VendorLink.sharedPricebookId` |

## Behaviour

### 1. Vendor directory (`/{org}/pricing/vendors`)

- Table: company, contact, email, trades (the org's tags, e.g. "concrete", "drywall"), status
  (invited / active), shared price list (name, item count, last updated, or "not shared"),
  offer requests sent, offers received, last activity. Search, filter by trade.
- **Invite vendor:** email, company, contact, trades → an email with `/vendor-invite/{token}`
  (30 days, resend possible). An email that already has a vendor account just gets linked.
- **Open a vendor:** their profile and the price list they share with this firm (read-only,
  searchable, F20 §4), the firm's requests to them and their offers.
- **Edit** the org's labels (trades, contact name). **Remove** the link: past requests and
  offers stay; their shared price list is no longer visible.
- Who: every org role may invite and edit while `membersCanInviteVendors` is on (default);
  otherwise owner and admin. Removing: owner and admin.

### 2. Vendor sign-up and the vendor area (`/vendor`)

- `/vendor-invite/{token}` → sign in or sign up (name, company; the email must match the
  invitation, or the token proves it) → link active.
- **Vendor home:** linked firms, open offer requests (F11), my pricebooks (F20).
- **Linked firms** (`/vendor/firms`): per firm, **which price list it sees** (one of the
  vendor's pricebooks, or none; default none until the vendor chooses), since when, requests
  received. "Leave" removes the link from the vendor's side.
- **Profile** (`/vendor/profile`): name, company, trades offered, phone.

### 3. Turning the module off, or removing it

The pricing module (vendors, pricebooks, estimates, offer requests) is behind a switch (P32):
a platform feature flag and a plan entitlement (`pricingModule`). It is built so it can also be
**removed** entirely without touching the core (P36, `04-architecture/modules.md`): its own
frontend package, backend module, database schema and API file. When off for an org: the
Vendors, Pricing and offer request screens and actions are hidden; existing data stays stored
and reappears when switched on again; vendors see that firm as "paused". When off for the
platform: no vendor sign-ups and no vendor area.

## Permissions

| Action | owner | admin | library_editor | member |
|---|---|---|---|---|
| See the vendor directory and shared price lists | ✓ | ✓ | ✓ | ✓ |
| Invite and edit vendors | ✓ | ✓ | ✓¹ | ✓¹ |
| Remove vendors | ✓ | ✓ | | |

¹ While `membersCanInviteVendors` is on. Offer requests: F11 and permissions.md.

## Edge cases

- A vendor linked to two orgs sees both firms separately and may share a different price list
  with each; neither org can see the other's link, lists, requests or offers.
- The vendor's email bounces: the invitation shows "undeliverable" and can be corrected.
- A vendor deletes a price list that a firm sees: the firm's link shows "not shared"; the firm's
  estimate keeps the rates it already took (with their source and date).

## API

`GET /pricing/orgs/{orgId}/vendors`, `POST /pricing/orgs/{orgId}/vendors`, `GET /pricing/vendor-links/{vendorLinkId}`,
`PATCH /pricing/vendor-links/{vendorLinkId}`, `DELETE /pricing/vendor-links/{vendorLinkId}`,
`POST /pricing/vendor-links/{vendorLinkId}/resend`, `GET /pricing/vendor-invitations/{token}`,
`POST /pricing/vendor-invitations/{token}/accept`, `GET /pricing/vendor/profile`, `PATCH /pricing/vendor/profile`,
`GET /pricing/vendor/firms`, `PATCH /pricing/vendor/firms/{vendorLinkId}` (shared price list),
`DELETE /pricing/vendor/firms/{vendorLinkId}` (leave).

## Acceptance criteria

- [ ] A member invites a vendor; the vendor signs up from the email and appears as active in the directory.
- [ ] A vendor linked to two orgs shares price list A with one and nothing with the other; each org sees exactly that, and neither can see the other's link (isolation suite).
- [ ] Switching the pricing module off for an org hides every vendor and pricing screen and returns `404` on their endpoints; switching it on again shows the same data.
