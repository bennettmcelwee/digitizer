import { BinaryOperator, Operator, UnaryOperator } from "./operators";

export type Status = 'idle' | 'running' | 'paused'

export type FormulaTextMap = Record<number, string>

export interface Snapshot {
    time: string,
    label: string,
    numberCount: number,
    setCounts: number[],
    setCount: number,
    setCurrent?: number,
    numbers?: number[],
    formulaMap?: FormulaTextMap,
}

/**
 * Changeable options that control how the solve runs
 */
export interface Options {

    digitString: string,
    useAllDigits: boolean,
    symbols: string[],
    // Display
    displayLimit: number,
    quiet: boolean,
    heartbeatSeconds: number,
    statusSeconds: number,
    // Internals
    valueLimit: number,
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

export interface FormulaSet {
    formulas: Formula[]
}

export interface SymbolDetails {
    symbol: string,
    description: string,
}
