# 13 Measurement standards: what exists and what each covers

An internal map of the measurement rulebooks a user might want to work to, and how much of our rule
template each one decides. It exists so nobody mistakes one standard for "the whole BoQ": most cover
only part of it, some cover none of what our rules do, and some cover more.

This page holds **names, scope and status only**. No text, tables, values or code lists from any
standard are reproduced here or anywhere in the repo (CLAUDE.md rule 8, docs 08). Licences and where
to buy are in 08; this page adds the world outside the UK and Germany and the coverage view.

Checked online on 13 Oct 2026 where marked **checked** (sources at the end). **Unverified** means it
comes from general knowledge and needs confirming before anyone relies on it. Editions age.

## How to read "coverage"

Our master template (`as-modelled`, 06) asks its questions in 13 sections. A standard "covers" a
section when it decides the answers there (units, deductions, what is included):

| # | Template section | Typical questions |
|---|---|---|
| 1 | General | lines per storey, rounding |
| 2 | Earthworks and substructure | excavation, working space, blinding, hardcore |
| 3 | Concrete, formwork, reinforcement | formwork separate, formwork rules, rebar |
| 4 | Walls | m2 or m3, from which thickness, which face |
| 5 | Openings and deductions | what is deducted, size limits, reveals |
| 6 | Floors and slabs | which surface, concrete separately |
| 7 | Roofs | along the slope or in plan, build-up layers |
| 8 | Stairs and railings | by count or length |
| 9 | Finishes | paint, skirting, room finishes |
| 10 | Steel and other members | mass basis, length basis |
| 11 | Services (MEP) | pipe length basis, fittings allowance |
| 12 | Preliminaries and sums | site setup, provisional sums |
| 13 | What is included | furniture, proxies, scope |

Standards fall into six kinds. The kind tells you most of the coverage:

| Kind | Covers | Example |
|---|---|---|
| **A. Whole building works** | Sections 1-13, usually more (see "beyond the template") | NRM2, ANZSMM, HKSMM4R |
| **B. Split by trade** | One part per trade; each part decides only its own section(s). Coverage = the parts you hold | VOB/C, ÖNORM B 22xx, IS 1200 |
| **C. Civil and infrastructure** | Earthworks (2) and some concrete (3); otherwise roads, drainage, bridges our template does not ask about | CESMM4, MMHW, US DOT specs |
| **D. Elemental / cost planning** | Grouping and a few elemental quantities, not detailed measurement; closer to a classification than to rules | NRM1, ICMS |
| **E. Floor-area standards** | Only how room and building areas are measured; touches room finishes (9) and nothing else | IPMS, DIN 277, NEN 2580 |
| **F. No national method / price-book practice** | Rules live in price books, contracts or firm practice; coverage varies by source | USA buildings, Italy, Spain |

A client's tender template (any country) can override any of them; that case is the item library /
template import in 08 and 11, not a standard.

## Kind A: whole building works

| Standard | Region | Publisher | Status | Notes |
|---|---|---|---|---|
| NRM2 (RICS New Rules of Measurement 2) | UK, Commonwealth, Middle East | RICS | Current, 2nd ed. Oct 2021 (08) | Free PDF. The main UK detailed-measurement method; also covers preliminaries and item description structure |
| SMM7 | UK (legacy) | RICS / CEC | Replaced by NRM2 in 2013 | Reference only; still met in older contracts |
| POMI (Principles of Measurement International) | Gulf, Middle East, parts of Asia | RICS (1979) | Old but widely used, **checked** | Short and principle-based, leaves much to the bill compiler. Regional surveys (undated) found it the most recognised method in the Middle East, with CESMM |
| ANZSMM 2018 (Australian and New Zealand SMM) | Australia, New Zealand | AIQS with NZIQS and Master Builders NZ | Current, **checked** | Joint trans-Tasman method that replaces the **ASMM** (Australia) and **NZS 4202:1995** (NZ). Tabulated format |
| HKSMM4R (Hong Kong SMM, 4th ed. revised 2018) | Hong Kong | HKIS | Current, **checked** | 4th ed. 2005 still named in some contracts. Has "deemed included below a size" rules for small holes and openings (our deduction thresholds express that) |
| Malaysian SMM2 | Malaysia | ISM / BQSM (**unverified**) | In use, **checked** | Commercial BIM take-off tools encode it section by section. Studies note weak coverage of building services (11) |
| Singapore SMM2 / CEMS (CP 97) | Singapore | SISV / SPRING (**unverified**) | **Checked**: SMM2 was to be replaced by CEMS Part 1 (CP 97) from 2010; how far that happened is not confirmed | Both descend from the RICS SMM |
| ASAQS Standard System of Measuring Building Work, 7th ed. (2015) | South Africa | ASAQS | Current, **checked** | Intended for use in other African countries too; AAQS published an Africa-wide 1st ed. (2015) on the 1991 ASAQS base |
| BESMM4R (Building and Engineering SMM, 4th revised ed.) | Nigeria | NIQS | Mandatory for NIQS members from Mar 2021, **checked** | Covers building, engineering and industrial works, so also some kind C |
| CIQS Method of Measurement of Construction Works | Canada | CIQS | In use (taught in college courses), **checked**; edition not confirmed | |
| 公共建築数量積算基準 (public building quantity standard) | Japan | MLIT, government buildings department | Current revision Reiwa 5 (2023), **checked** | Published by the ministry. The BSIJ (Building Surveyors Institute of Japan) publishes the related 建築数量積算基準 (2017 ed. seen; later editions not confirmed). A separate standard for building services exists (**unverified**) |
| GB/T 50854-2024 (building and decoration works quantity calculation) | China | MOHURD | Current, **checked** (replaces GB 50854-2013) | Works together with GB/T 50500-2024 (BoQ pricing, in force 1 Sep 2025). Services and municipal works have their own standards (GB/T 50856-2024, GB/T 50857-2024) |
| GESN (state elemental estimate norms), technical parts | Russia, parts of the CIS | Ministry of Construction (RU) | In force, **checked** in part | Quantities are counted in the units of each norm and by the counting rules in each collection's technical part. Some units our engine has no field for, e.g. per 100 m3 of building volume |

## Kind B: split by trade

| Standard | Region | Publisher | Status | Notes |
|---|---|---|---|---|
| VOB/C: DIN 18299 + trade ATVs DIN 18300-18459 | Germany | DIN (DIN Media) | Current; 2023 supplement (08) | Each ATV has its own "Abrechnung" section, e.g. earthworks, concrete, masonry, painting. **Licence restrictions are strict (08)**: bring-your-own only, never feed to AI tools |
| ÖNORM B 22xx / H 22xx (Werkvertragsnormen) + LB-HB / LB-HT | Austria | Austrian Standards; LB by the ministry (BMWET) | **Checked**: LB-HB version 023 (Dec 2025) current | Quantities follow the billing rules of the relevant B 22xx norm; LB-HB is the standard item catalogue. LB-HB is free to use but copyrighted by the ministry (08 says "free"; it is not free of rights) |
| SIA 118 + NPK | Switzerland | SIA; NPK by CRB | In use, **checked** | NPK chapters build on SIA 118 and the general conditions (ABB); measurement rules sit in the NPK chapters (**unverified** in detail) |
| IS 1200 (method of measurement, many parts) | India | BIS | **Checked**: parts per trade (earthwork, concrete, formwork, brickwork, steelwork, ceilings, floors, painting, plumbing, pipelines, tunnelling…) | Covers civil works too; a possible new edition of the base standard was not confirmed |
| NS 3420 | Norway | Standard Norge | Current (2024 version seen), **checked** | A collection of many part-standards with description texts and quantity rules, used for tender quantity lists |
| AMA + MER (Hus, Anläggning, VVS & Kyl, El) | Sweden | Svensk Byggtjänst | Current, **checked** | Technical AMA texts plus MER (measurement and payment rules) for work described per AMA; new generations about every three years |
| KNR (catalogues of material and labour inputs) | Poland | Various publishers (**unverified**) | In use for cost estimates, **checked** only as in use | Each catalogue has general rules on counting quantities (**unverified**) |

## Kind C: civil and infrastructure

| Standard | Region | Publisher | Status | Notes |
|---|---|---|---|---|
| CESMM4 Revised | UK, used internationally | ICE | Current (08) | Civil engineering, not buildings |
| MMHW (MCHW Volume 4: Bills of Quantities for Highway Works) | UK | National Highways | **Checked**: being updated; some series already replaced by CC 120/MMHW | Method of measurement, notes for guidance, library of standard item descriptions |
| State DOT standard specifications | USA | Each state DOT (AASHTO guide) | **Unverified** | Every pay item has a "Method of measurement" and "Basis of payment" subsection; the de facto US civil method |
| CROW RAW | Netherlands | CROW | **Unverified** | Standard conditions for civil works, including measurement |
| GB/T 50857-2024 | China | MOHURD | **Checked** (listed) | Municipal engineering quantities |

## Kind D: elemental and cost planning

| Standard | Region | Notes |
|---|---|---|
| NRM1 | UK | Elemental cost estimating; includes rules for elemental quantities and floor area (08) |
| ICMS 3 | International | Cost reporting structure across countries and project types; free (08) |
| UniFormat / UniFormat II | North America | Element classification (CSI / ASTM); licence needed (08) |
| DIN 276 | Germany | Cost groups; classification, not measurement (08) |

These belong mostly in **classifications** (input 3), not in rule sets.

## Kind E: floor-area standards

| Standard | Region | Notes |
|---|---|---|
| IPMS | International | Property area measurement (RICS and coalition); adopted in some Gulf projects (**checked**) |
| RICS Code of Measuring Practice / RICS Property Measurement | UK | Areas for property, not BoQs |
| DIN 277 | Germany | Floor areas and volumes of buildings (licence as other DIN) |
| NEN 2580 | Netherlands | Floor areas and volumes (**unverified** edition) |
| BOMA | North America | Office and commercial floor area |

Relevant only to room-based quantities (`floor_area`, `wall_area`, `perimeter` on spaces) and to
area KPIs, not to element measuring.

## Kind F: no single national method

| Region | How it works | Status |
|---|---|---|
| USA (buildings) | Firm practice, organised by MasterFormat (licence, 08); ASPE publishes estimating practice | 08; ASPE **unverified** |
| France | No national measurement method; rules in the tender documents (CCTP) and trade guides | **Unverified** |
| Italy | Regional price lists (prezzari regionali) carry measurement criteria per item | **Unverified** |
| Spain | Regional and commercial price bases (e.g. BEDEC by ITeC) carry measurement criteria | **Unverified** |
| Former Yugoslavia | Legacy construction norms (GN) and average norms, mainly for labour and material inputs; current practice mixes these with tender documents | 08; details **unverified** |

## Beyond the template: what standards decide that our rules cannot yet

A standard being "kind A" does not mean our template can hold all of it. Patterns met while checking:

| Pattern | In our rules today |
|---|---|
| Small openings, holes or items "deemed included" below a size | Yes: deduction mode `over_threshold` with a threshold slot |
| Cladding or finishes measured without deducting openings | Yes: deduction mode `none` |
| Units from building geometry, e.g. per 100 m3 of building volume (GESN) | Yes: `building.gross_volume` and other building values in formulas (derived values are approximate) |
| Area between the inner faces of walls, excluding columns (room-based floors) | Yes: room floor area, columns standing in the room deducted when answered |
| Recesses (niches, chases) treated differently from openings | Yes: their own opening kind and deduction |
| Existing and demolished work in renovation | Yes: the rule set's scope, demolition items |
| Item description structure and standard wording | No: the item library gap (08, gap 4) |
| Labours and ancillary work deemed included in the main item | Only as description text; no separate concept |
| Separate standards for building services (China, Japan, Malaysia studies) | MEP is one template section; a services-specific rule set would extend it |
| Measurement tied to price-book items (KNR, GESN, regional prezzari) | No: needs the item library / template import |

Each "No" is a candidate rule-language feature (06, "growing it") or an item-library feature, not a
special case per standard (CLAUDE.md rule 3).

## What this means for presets

- The repo ships **no preset per standard** and no empty placeholders: an empty "NRM2" preset would
  run the neutral defaults under a standard's name (D32).
- A user who works to a standard builds a rule set on `as-modelled` and records it in "based on"
  (free text). For a kind B standard they answer only the sections their trade parts cover.
- Which standard comes first is still open (11, open questions); D33 favours NRM 1/2.

## Sources

- AIQS / ANZSMM: https://www.fnu.ac.fj/?p=31042, https://buildingtoday.co.nz/?p=5026
- NZS 4202:1995: https://www.standards.govt.nz/shop/NZS-42021995
- HKSMM4 / HKSMM4R: https://kctang.com.hk/web/node/252, https://kctang.com.hk/web/node/251
- ASAQS 7th edition: https://www.asaqs.co.za/news/253985/New-Standard-System-of-Measuring-Building-Work-in-South-Africa.htm, https://www.asaqs.co.za/news/396488/A-brief-history-of-the-standard-system-of-measurement-in-South-Africa.htm, https://aaqs.org/standard-method/
- BESMM4R: https://niqs.org.ng/agm2020-workshop/, https://guardian.ng/?p=116091
- Malaysian SMM2: https://info.cype.com/en/new-feature/incorporating-more-sections-of-the-malaysian-standard-method-of-measurement-for-building-works-smm2/, https://uilspace.unilorin.edu.ng/items/a5dbc3b5-e802-4691-b212-18013cfa76ed
- Singapore SMM2 / CEMS: https://www.sisv.org.sg/Courses/Course_Calendar/CERTIFICATECOURSE-Measurement(1stIntake).pdf
- CIQS: https://www.bcit.ca/courses/construction-estimating-2-bldt-3091/
- Japan MLIT standard: https://www.pref.shiga.lg.jp/file/attachment/5594576.pdf, https://www.mlit.go.jp/report/press/eizen02_hh_000253.html, https://www.bsij.or.jp/news/20170508/170420_suuryou_sekisan_kijyun.pdf
- China GB/T 50500-2024, GB/T 50854-2024: https://www.chinesestandard.net/Related.aspx/GB50500-2013, https://zjw.sh.gov.cn/cmsres/54/542d051e03ec482eb9d7f34ca3733cc1/b80791aa8c389e36eb5f8dc5f0058ce6.pdf
- GESN: https://forum.smeta.ru/download/file.php?id=770
- IS 1200: https://services.bis.gov.in/tmp/17410_22112024171414_6.pdf
- NS 3420: https://online.standard.no/en/ns-3420-v-2024
- AMA / MER: https://byggtjanstcms.byggtjanst.se/globalassets/bokhandeln/provlas/provlas_mer-anlaggning_fragor-och-svar_utg-2.pdf, https://malmo.se/Teknisk-handbok/Projekteringsstod/AMA-mallar.html
- ÖNORM B 22xx and LB-HB: https://repositum.tuwien.at/retrieve/2515, https://www.bmwet.gv.at/Services/Bauservice/Hochbau.html
- SIA 118 / NPK: https://www.crb.ch/_Resources/Persistent/e/0/5/d/e05d98faef5fed0b8b48715db0c48d81196e7263/Anwendung_151D23.pdf
- POMI: https://fount.aucegypt.edu/etds/276, https://www.isurv.com/info/390/features_archive/10116/ipms_adoption_in_the_middle_east
- MMHW: https://www.ciht.org.uk/media/11334/1-mchw-vol-4-review-briefing-paper-for-stakeholders-and-consultees-v1.pdf, https://information-hub.standardsforhighways.co.uk/?p=1734
- UK, Germany, CSI and the rest: see 08.
