// Copyright 2023 Bennett McElwee. All rights reserved.
import { BinaryOperator, Operator, UnaryOperator } from "./operators";

export type Status = 'idle' | 'running' | 'paused' | 'done'

export type FormulaTextMap = Record<number, string>

export type QueueStrategy = 'depth-first' | 'breadth-first'

export interface Snapshot {
    runId: number,
    // current
    queueSize: number,
    cacheSize: number,
    // progress
    processingTimeMs: number,
    checkedTotal: number,
    cacheHitTotal: number,
    processedTotal: number,
    solutionCount: number,
    solutions?: Set<number>,
    formulaMap?: FormulaTextMap,
}

/**
 * Changeable options that control how the solve runs
 */
export interface Options {

    digitString: string,
    useAllDigits: boolean,
    preserveOrder: boolean,
    symbols: string[],
    advanced: boolean,
    // Display
    displayLimit: number,
    quiet: boolean,
    heartbeatSeconds: number,
    // Internals
    valueLimit: number,
    strategy: QueueStrategy,
    // Timing
    yieldSeconds: number,
    maxDurationSeconds: number,
    minHeartbeats: number,
}

/**
 * Parameters for the solve
 */
export interface Settings extends Options {
    digits: number[],
    allowParens: boolean,
    heartbeatMs: number,
    yieldMs: number,
    unaryOperators: UnaryOperator[],
    binaryOperators: BinaryOperator[],
}

export interface Formula {
    value: number,
    text: string,
    operator: Operator | null,
    digits: number[],
}

export interface FormulaGroup {
    formulas: Formula[]
}

export interface SymbolDetails {
    symbol: string,
    descriptions: string[],
}
