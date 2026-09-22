import { formatResolvedValue } from "./formatResolvedValue.ts";
import type { EvalPlan } from "./plan.ts";

export interface EmittedReplacement {
	start: number;
	end: number;
	replacement: string;
}

/**
 * Emit a serialisable comptime result back into a source replacement.
 *
 * The replacement spans exactly the plan's origin range, so position
 * based tooling (MagicString, source maps) maps the emitted code back
 * to the original expression. Parentheses and precedence of the
 * surrounding code are preserved because only the expression's own
 * range is replaced; object literals are parenthesised by
 * `formatResolvedValue` so they never become statements.
 *
 * Serialisation rules for `undefined`, `bigint` and `RegExp` are
 * defined in `formatResolvedValue` and documented in SERIALISATION.md.
 */
export function emitReplacement(plan: EvalPlan, value: unknown): EmittedReplacement {
	return {
		start: plan.origin.start,
		end: plan.origin.end,
		replacement: formatResolvedValue(value),
	};
}
