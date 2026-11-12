import { describeErrors, loadSpec, type Operation, type Spec } from "@ifc-boq/api/spec";

/** The contract, for checks every backend must pass (status codes, error bodies, response shapes). */
let specPromise: Promise<Spec> | null = null;
export const spec = () => (specPromise ??= loadSpec());

export function operationsByTag(s: Spec): Map<string, Operation[]> {
  const out = new Map<string, Operation[]>();
  for (const op of s.operations) {
    const tags = (op.raw.tags as string[] | undefined) ?? ["untagged"];
    for (const tag of tags) out.set(tag, [...(out.get(tag) ?? []), op]);
  }
  return out;
}

/** A concrete URL path for an operation: uuid-looking values for every path parameter. */
export function samplePath(op: Operation): string {
  return op.path.replace(/\{(\w+)\}/g, (_m, name: string) => (/(token|guid|kind)$/i.test(name) ? "sample" : "0193a2b4-0000-7000-8000-000000000000"));
}

/** Throws with the validation errors when `body` doesn't match a component schema. */
export async function expectSchema(schemaName: string, body: unknown) {
  const s = await spec();
  const validate = s.validator(`#/components/schemas/${schemaName}`);
  if (!validate(body)) throw new Error(`${schemaName} mismatch: ${JSON.stringify(describeErrors(validate.errors), null, 1)}`);
}
