/**
 * F10 §8 code-list import (FE-023): read a spreadsheet's sheets (with the engine's guess of which
 * column is what), then build codes from its rows and a column mapping. Both are the engine's work
 * (`codelist_import.py`), so the app and the command-line importer agree. Nothing is stored: the
 * classification editor puts the built codes into its draft. Any signed-in user may call them.
 */
import type { CodeListBuildRequest } from "@ifc-boq/types";
import type { Schemas } from "@ifc-boq/api";
import { EngineRefused, EngineUnavailable, engine } from "../engine/engine.js";
import { HttpError } from "../http.js";
import { json, type Handlers } from "../router.js";

const engineDown = () => new HttpError(503, "engine_unavailable", "The processing service is not available. Try again.");

export const codeListHandlers: Handlers = {
  async readCodeListFile({ body }) {
    const file = body instanceof FormData ? body.get("file") : null;
    if (!file || typeof file === "string") throw new HttpError(400, "invalid_body", 'Send the spreadsheet as the multipart field "file".');
    try {
      return json(await engine().readCodeTable(file, file.name || "codes.csv"));
    } catch (e) {
      if (e instanceof EngineUnavailable) throw engineDown();
      if (e instanceof EngineRefused && e.status === 413) throw new HttpError(413, "too_large", e.message);
      if (e instanceof EngineRefused && e.status < 500) throw new HttpError(400, "invalid_file", e.message);
      throw e;
    }
  },

  async buildCodeList({ body }) {
    const req = body as Schemas["CodeListBuildRequest"];
    if (req.code === undefined || req.title === undefined) throw new HttpError(400, "invalid_body", "Choose the code column and the title column.");
    // The contract has the columns at the top level; the engine takes them as `mapping`.
    const mapping: CodeListBuildRequest["mapping"] = { code: req.code, title: req.title };
    for (const k of ["parent", "description", "level"] as const) if (req[k] !== undefined) mapping[k] = req[k];
    try {
      return json(await engine().buildCodeList({ rows: req.rows, headerRow: req.headerRow, mapping, hierarchy: req.hierarchy, separator: req.separator ?? null }));
    } catch (e) {
      if (e instanceof EngineUnavailable) throw engineDown();
      if (e instanceof EngineRefused && e.status < 500) throw new HttpError(400, "invalid_body", e.message);
      throw e;
    }
  },
};
