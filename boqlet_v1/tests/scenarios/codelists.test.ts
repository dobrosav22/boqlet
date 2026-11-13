import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client } from "../support/env";
import { user, type TestUser } from "../support/users";

/**
 * F10 §8 code-list import (FE-023): `POST /codelists/read` reads a spreadsheet's sheets with a
 * guess of its columns, `POST /codelists/build` turns rows and a column mapping into codes, with
 * the hierarchy, problems (duplicates…) and stats. Nothing is stored.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PYTHON = path.join(ROOT, "engine", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");

/** Three levels (10 › 10.20 › 10.20.30) and one code given twice, as a header row plus rows. */
const ROWS = [
  ["Code", "Title", "Description"],
  ["10", "Substructure", ""],
  ["10.20", "Foundations", ""],
  ["10.20.30", "Strip foundations", "Concrete strip footings, {thickness} thick"],
  ["10.20.40", "Pad foundations", ""],
  ["20", "Superstructure", ""],
  ["20.10", "Frame", ""],
  ["10.20", "Foundations again", ""],
];

let dir: string;
let ivana: TestUser;

/** An .xlsx written by the engine's own openpyxl (no new dependencies for the suites). */
function xlsx(file: string, rows: string[][]): Uint8Array<ArrayBuffer> {
  const script = ["import json, sys", "from openpyxl import Workbook", "wb = Workbook()", "ws = wb.active", "ws.title = 'Codes'", "for r in json.loads(sys.argv[2]): ws.append(r)", "wb.save(sys.argv[1])"].join("\n");
  execFileSync(PYTHON, ["-c", script, file, JSON.stringify(rows)], { env: { ...process.env, PYTHONUTF8: "1" } });
  return new Uint8Array(readFileSync(file));
}

const upload = (token: string, bytes: Uint8Array<ArrayBuffer> | string, name: string) =>
  client(token).POST("/codelists/read", {
    body: { file: name },
    bodySerializer: () => {
      const form = new FormData();
      form.append("file", new Blob([bytes]), name);
      return form;
    },
  });

beforeAll(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), "boqlet-codelists-"));
  ivana = await user("ivana");
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("F10 code-list import", () => {
  it("F10-AC4 importing an xlsx code list with 3 levels builds the hierarchy and reports duplicates", async () => {
    expect(existsSync(PYTHON), "the engine's venv (npm run setup:engine)").toBe(true);
    const { data: read, response } = await upload(ivana.token, xlsx(path.join(dir, "codes.xlsx"), ROWS), "codes.xlsx");
    expect(response.status).toBe(200);
    expect(read!.sheets).toHaveLength(1);
    const sheet = read!.sheets[0]!;
    expect(sheet.name).toBe("Codes");
    expect(sheet.rows).toEqual(ROWS);
    // The engine guesses the header, the columns and the separator.
    expect(sheet.guess).toMatchObject({ headerRow: 0, code: 0, title: 1, description: 2, separator: "." });

    const { data: built } = await client(ivana.token).POST("/codelists/build", {
      body: { rows: sheet.rows, headerRow: 0, code: 0, title: 1, description: 2, hierarchy: "separator", separator: "." },
    });
    expect(built!.stats).toMatchObject({ codes: 6, top: 2, levels: 3, duplicates: 1 });
    const byCode = new Map(built!.codes.map((c) => [c.code, c]));
    expect(byCode.get("10")).toMatchObject({ level: 0 });
    expect(byCode.get("10.20")).toMatchObject({ title: "Foundations", parent: "10", level: 1 });
    expect(byCode.get("10.20.30")).toMatchObject({ parent: "10.20", level: 2, description: "Concrete strip footings, {thickness} thick" });
    expect(built!.problems.some((p) => p.includes("10.20") && p.includes("again"))).toBe(true);
  });

  it("reads a CSV and builds a hierarchy from a level column", async () => {
    const csv = "Level;Code;Name\n1;A;Walls\n2;A1;External walls\n3;A1a;Cavity walls\n2;A2;Internal walls\n";
    const { data: read } = await upload(ivana.token, csv, "levels.csv");
    const sheet = read!.sheets[0]!;
    expect(sheet.guess).toMatchObject({ headerRow: 0, level: 0, code: 1, title: 2 });
    const { data: built } = await client(ivana.token).POST("/codelists/build", { body: { rows: sheet.rows, headerRow: 0, code: 1, title: 2, level: 0, hierarchy: "level" } });
    expect(built!.stats).toMatchObject({ codes: 4, top: 1, levels: 3, duplicates: 0 });
    expect(built!.codes.find((c) => c.code === "A1a")).toMatchObject({ parent: "A1", level: 2 });
    expect(built!.problems).toEqual([]);
  });

  it("refuses an unreadable file with invalid_file and the engine's reason", async () => {
    const res = await upload(ivana.token, "%PDF-1.4", "codes.pdf");
    expect(res.response.status).toBe(400);
    expect(res.error).toMatchObject({ code: "invalid_file" });
    expect((res.error as unknown as { message: string }).message).toMatch(/xlsx/);
    const broken = await upload(ivana.token, "not a workbook", "codes.xlsx");
    expect(broken.response.status).toBe(400);
    expect(broken.error).toMatchObject({ code: "invalid_file" });
  });

  it("needs the code and title columns, and a signed-in user", async () => {
    const missing = await client(ivana.token).POST("/codelists/build", { body: { rows: ROWS, headerRow: 0, code: 0, hierarchy: "flat" } });
    expect(missing.response.status).toBe(400);
    expect(missing.error).toMatchObject({ code: "invalid_body" });
    const anonymous = await client().POST("/codelists/build", { body: { rows: ROWS, headerRow: 0, code: 0, title: 1, hierarchy: "flat" } });
    expect(anonymous.response.status).toBe(401);
  });
});
