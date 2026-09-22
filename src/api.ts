import {
	applyComptimeReplacements,
	getComptimeReplacements,
	type GetComptimeReplacementsOpts,
	type Filterable,
} from "./comptime.ts";

export type { Replacements } from "./comptime.ts";
export { getComptimeReplacements, applyComptimeReplacements };
export type { EvalPlan, PlanCapability, SourceOrigin } from "./plan.ts";
export type { EvalHost, EvalRecord } from "./evaluator.ts";
export { evaluatePlan } from "./evaluator.ts";
export { emitReplacement } from "./emitter.ts";

export async function comptimeCompiler(opts?: Filterable<GetComptimeReplacementsOpts>, outdir?: string) {
	const replacements = await getComptimeReplacements(opts);
	await applyComptimeReplacements({ ...opts, outdir }, replacements);
}
