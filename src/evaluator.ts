import { w } from "w";
import { format } from "node:util";
import { asyncLocalStore, type ComptimeContext } from "./async_store.ts";
import { box } from "./errors.ts";
import type { EvalPlan, PlanCapability, SourceOrigin } from "./plan.ts";

export interface EvalRecord {
	plan: {
		id: string;
		origin: SourceOrigin;
		freeBindings: string[];
		capabilities: PlanCapability[];
	};
	status: "ok" | "error";
	value?: unknown;
	error?: unknown;
}

/**
 * The explicit host an evaluator needs: a comptime context for the
 * evaluated code to talk back to (defer queue, source position), and
 * an optional record hook observing each evaluation.
 */
export interface EvalHost {
	context: ComptimeContext;
	record?(record: EvalRecord): void;
}

export type EvalStage = "create" | "evaluate";

/**
 * Thrown when a plan fails to evaluate. Carries the stage at which
 * evaluation failed so callers can map it to a diagnostic error code.
 */
export class PlanEvaluationError extends Error {
	constructor(
		public readonly stage: EvalStage,
		public readonly plan: EvalPlan,
		cause: unknown,
	) {
		super(`Failed to evaluate plan ${plan.id} at stage "${stage}"`, { cause });
	}
}

const logs = {
	evalContext: w("comptime:eval"),
};

/**
 * Evaluate a single validated plan against an explicit host.
 * Plans never see the original AST; each plan runs in its own
 * isolated async context, so a failure cannot corrupt other plans.
 */
export async function evaluatePlan(plan: EvalPlan, host: EvalHost): Promise<unknown> {
	const report = (status: "ok" | "error", extra: { value?: unknown; error?: unknown }) => {
		host.record?.({
			plan: {
				id: plan.id,
				origin: plan.origin,
				freeBindings: plan.freeBindings,
				capabilities: plan.capabilities,
			},
			status,
			...extra,
		});
	};

	if (logs.evalContext.enabled) {
		logs.evalContext(
			"\n\n" +
				box(
					[
						box(plan.transpiled),
						"-- with comptime context: " + format(host.context),
						"From: " + plan.id,
					].join("\n\n"),
					{
						title: "evaluation block",
					},
				),
			"\n",
		);
	}

	let func: Function;
	try {
		func = new Function(
			"__comptime_context",
			"asyncLocalStore",
			plan.transpiled + "\nreturn asyncLocalStore.run({ __comptime_context }, evaluate);",
		);
	} catch (e) {
		report("error", { error: e });
		throw new PlanEvaluationError("create", plan, e);
	}

	try {
		const resolved: unknown = await func(host.context, asyncLocalStore);
		report("ok", { value: resolved });
		return resolved;
	} catch (e) {
		report("error", { error: e });
		throw new PlanEvaluationError("evaluate", plan, e);
	}
}
