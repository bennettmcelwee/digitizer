export type Status = 'idle' | 'running' | 'paused'

export interface Snapshot {
    time: string,
    label: string,
    numberCount: number,
    setCounts: number[],
    setCount: number,
    setCurrent?: number,
    numbers?: number[],
    formulaMap?: {[value: number]: string},
}

export interface Settings {
    digitString: string,
    useAllDigits: boolean,
    symbols?: string[],
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

    allOperators: Operator[],
}

export interface Operator {
    symbol: string,
    description: string,
}