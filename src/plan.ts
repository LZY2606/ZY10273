import * as ts from "typescript";
import { query } from "./comptime.ts";

/**
 * Where in the original source a plan was lowered from.
 * The original AST is never mutated; replacements are only
 * emitted against these positions after every plan succeeds.
 */
export interface SourceOrigin {
	fileName: string;
	start: number;
	end: number;
}

/**
 * Capabilities a plan requires from the evaluation host.
 *
 * - `import`: the plan's declaration closure dynamically imports modules.
 * - `async`: the plan awaits a promise (or imports, which are async).
 */
export type PlanCapability = "import" | "async";

/**
 * A restricted, validated intermediate representation of a single
 * comptime expression. The front-end lowers supported expressions to
 * plans; the evaluator consumes only plans and an explicit host; the
 * emitter turns the evaluated results back into replacements.
 */
export interface EvalPlan {
	/** Stable identifier: `fileName:start:end`. */
	id: string;
	origin: SourceOrigin;
	/** Identifier names the expression references from its surrounding scope. */
	freeBindings: string[];
	capabilities: PlanCapability[];
	/** TypeScript source of the evaluation block, before type erasure. */
	source: string;
	/** Validated, type-erased JavaScript evaluation block. */
	transpiled: string;
}

export function makePlanId(origin: SourceOrigin): string {
	return `${origin.fileName}:${origin.start}:${origin.end}`;
}

export function getFreeBindings(target: ts.Node): string[] {
	const seen = new Set<string>();
	const bindings: string[] = [];
	for (const idn of query<ts.Identifier>(target, ts.SyntaxKind.Identifier)) {
		const parent = idn.parent;
		// ignore the right hand side of property accesses: `foo.bar` binds `foo`, not `bar`
		if (ts.isPropertyAccessExpression(parent) && parent.name === idn) continue;
		if (seen.has(idn.text)) continue;
		seen.add(idn.text);
		bindings.push(idn.text);
	}
	return bindings;
}

export function getCapabilities(target: ts.Node, hasImports: boolean): PlanCapability[] {
	const capabilities: PlanCapability[] = [];
	if (hasImports) capabilities.push("import");
	const awaits = query<ts.AwaitExpression>(target, ts.SyntaxKind.AwaitExpression);
	if (hasImports || awaits.length > 0) capabilities.push("async");
	return capabilities;
}

/**
 * Plans are ordered by source position, which is a valid dependency
 * order: declarations always precede their uses in a source file.
 * Independent plans keep their relative order and are evaluated in
 * isolation from each other.
 */
export function sortPlans<P extends { origin: SourceOrigin }>(plans: P[]): P[] {
	return plans.slice().sort((a, b) => a.origin.start - b.origin.start);
}
