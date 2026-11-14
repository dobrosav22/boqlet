/**
 * The only file that imports modules (P36, architecture.md "Modules"; a lint rule forbids
 * `@ifc-boq/pricing-ui` anywhere else). A module registers its extensions here, at startup, only
 * when its build flag is set; without it the app is the core alone and every core test passes.
 *
 * The pricing module (`packages/pricing-ui`, FE-P1…FE-P7) is for a later phase (P48). When it is
 * built, its registration goes here behind `MODULE_PRICING`:
 *
 *   import { registerPricing } from "@ifc-boq/pricing-ui";
 *   if (process.env.MODULE_PRICING === "1") registerPricing();
 */

/** Module ids registered in this build (none yet). */
export const MODULES: readonly string[] = [];
