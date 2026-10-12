# buildingSMART certification samples

A subset of [buildingSMART/Certification-datasets](https://github.com/buildingSMART/Certification-datasets)
(commit `80d976a`, 2026-09-04), copied unchanged.

Copyright © buildingSMART International Ltd. Licensed under
[Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).

| Folder | Source folder | Files |
|---|---|---|
| `IFC2X3/` | `IFC 2.3.0.1 (IFC 2x3 TC1)/Simple-Scene` | Building-Architecture, Building-Structural, Building-Hvac |
| `IFC4/` | `IFC 4.0.2.1 (IFC 4 ADD2 TC1)/Simple-Scene` | Building-Architecture, Building-Structural |
| `IFC4/` | `IFC 4.0.2.1 (IFC 4 ADD2 TC1)/ISO Spec - ReferenceView_V1.2` | wall-with-opening-and-window, column-straight-rectangle-tessellation |
| `IFC4X3/` | `IFC 4.3.2.0 (IFC 4.3 ADD2)/Simple-Scene` | Building-Architecture, Building-Structural, Building-Hvac, Infra-Bridge, Infra-Road |

The Simple-Scene files are one scene (a house on a site with a road, a rail track and two
bridges) exported by SketchUp 2026 with Sketchup-IFC-manager 5.6.0 to all three schemas, so
the same element can be compared across IFC2x3 (faceted Brep), IFC4 and IFC4.3 (triangulated
face sets). The ISO files are small hand-written examples from the IFC4 Reference View.

What the engine learned from them, and the tests that pin it, are in
`docs/09-validation-and-test-corpus.md` and `engine/tests/test_certification_samples.py`.
To run the whole dataset (35 files), clone it and use `npm run corpus -- <folder>`.
