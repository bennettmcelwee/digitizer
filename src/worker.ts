// Copyright 2023 Bennett McElwee. All rights reserved.
import { Formula, FormulaGroup, FormulaTextMap, Options, Settings } from './types'
import { BinaryOperator, Operator, UnaryOperator, allOperators } from './operators'
import { AppMessage } from './app/page'

type FormulaMap = Record<number, Formula>

type QueueStrategy = 'depthfirst' | 'breadthfirst'

interface Queue {
    length: () => number,
    strategy: QueueStrategy,
    enqueue: (group: FormulaGroup) => void,
    dequeue: () => FormulaGroup | undefined,
}

class QueueImpl implements Queue {
    constructor(groups: FormulaGroup[], strategy: QueueStrategy) {
        this.queue = groups
        this.first = 0
        this.strategy = strategy
    }
    queue: FormulaGroup[]
    first: number
    strategy: QueueStrategy
    length() { return this.queue.length - this.first }
    enqueue(group: FormulaGroup) { this.queue.push(group) }
    dequeue() {
        switch (this.strategy) {
            case 'depthfirst': return this.queue.pop()!
            // case 'breadthfirst': return this.queue.shift()!
            case 'breadthfirst': {
                if (this.first < this.queue.length) {
                    return this.queue[this.first++]
                } else {
                    return undefined
                }
            }
        }
    }
}

interface State {
    runId: number,
    running: boolean,
    pause: boolean,
    // current
    queue: Queue, // the current queue of groups to be processed
    queuedCache: Set<string>, // cache of ids of processed groups
    // progress
    processingTimeMs: number,
    queuedTotal: number, // number of groups added to the queue
    cacheHitTotal: number, // number of groups not added to the queue because they were in the cache
    processedTotal: number, // number of groups processed and removed from the queue
    solutions: FormulaMap,

    currentStartTimestamp?: number | null,
    nextHeartbeat?: number | null,
    nextYield?: number | null,
}

let settings: Settings

export type WorkerMessage = {
    command: 'start'
    options: Options
} | {
    command: 'pause' | 'resume' | 'stop'
}

let savedState: State

onmessage = function(e: MessageEvent<WorkerMessage>) {
    switch (e.data.command) {
        case 'start': {
            clearMessages()
            settings = buildSettings(e.data.options)
            savedState = buildInitialState()
            showMessage('Starting')
            showSnapshot(savedState)
            scheduleContinue(savedState)
            break;
        }
        case 'pause': {
            savedState.pause = true
            break;
        }
        case 'resume': {
            savedState.pause = false
            showMessage('Resuming')
            scheduleContinue(savedState)
            break;
        }
        case 'stop': {
            savedState.running = false
            savedState.pause = false
            showMessage('Stopping')
            scheduleContinue(savedState) // process the Stop command
            break;
        }
    }
}

////////////////////

function scheduleContinue(state: State) {
    setTimeout(doContinue, 0, state)
}

function doContinue(state: State) {
    try {
        if ( ! state.running) {
            throw 'stop'
        }
        if (state.pause) {
            throw 'pause'
        }
        postAppMessage({
            status: 'running'
        })
        let processing = true
        while (processing) {
            processing = processNextGroup(state)
        }
        showMessage('Finished (complete)')
        showSnapshot(state, true)
        postAppMessage({
            status: 'done'
        })
    }
    catch (ex) {
        if (ex === 'yield') {
            showMessage('Yielding')
            scheduleContinue(state)
        }
        else if (ex === 'pause') {
            stopProcessing(state)
            showMessage('Pausing')
            showSnapshot(state, true)
            postAppMessage({
                status: 'paused'
            })
        }
        else if (ex === 'stop') {
            stopProcessing(state)
            showMessage('Finished (stopped)')
            showSnapshot(state, true)
            postAppMessage({
                status: 'idle'
            })
        }
        else {
            throw ex
        }
    }
}

function buildSettings(options: Options): Settings {
    const operators = allOperators.filter(operator => options.symbols.includes(operator.symbol))
    return {
        ...options,
        // "preserve order" only makes sense if we have to use all digits
        preserveOrder: options.preserveOrder && options.useAllDigits,
        allowParens: options.symbols?.includes('( )'),
        heartbeatMs: options.heartbeatSeconds * 1000,
        yieldMs: options.yieldSeconds * 1000,
        digits: options.digitString.split('').map(Number),
        unaryOperators: operators.filter(_ => _ instanceof UnaryOperator) as UnaryOperator[],
        binaryOperators: operators.filter(_ => _ instanceof BinaryOperator) as BinaryOperator[],
    }
}

function buildInitialState(): State {
    const digits = settings.digits ?? []
    // add a single group consisting of all the digits
    const state: State = {
        runId: new Date().getTime(),
        running: true,
        pause: false,
        processingTimeMs: 0,
        queuedTotal: 1,
        processedTotal: 0,
        cacheHitTotal: 0,
        queuedCache: new Set<string>(),
        queue: new QueueImpl(
            [{ formulas: digits.map(digitToFormula) }],
            'breadthfirst'
            // 'depthfirst'
        ),
        solutions: {},
    }
    return state
}

function getProcessingTime(state: State) {
    return state.processingTimeMs +
        (state.currentStartTimestamp ? (new Date().getTime() - state.currentStartTimestamp) : 0)

}

function startProcessing(state: State) {
    if ( ! state.currentStartTimestamp) {
        state.currentStartTimestamp = new Date().getTime()
        state.nextHeartbeat = 1
        state.nextYield = 1
    }
}

function stopProcessing(state: State) {
    state.processingTimeMs = getProcessingTime(state)
    state.currentStartTimestamp = null
    state.nextHeartbeat = null
    state.nextYield = null
}

/**
 * Process a group from the queue
 * @param state
 * @returns true if we need to keep going, false if we're finished
 */
function processNextGroup(state: State) {

    const GROUPS_PER_HEARTBEAT = 10000

    startProcessing(state)

    const { queue } = state

    const group = queue?.dequeue()
    if (!group) {
        return false
    }

    // Check if this group is a solution
    if (group.formulas.length === 1 || !settings.useAllDigits) {
        addSolutions(state.solutions, group.formulas)
    }
    const evolvedGroups = evolveGroup(group)

    for (const evolvedGroup of evolvedGroups) {
        const id = groupId(evolvedGroup)
        if (state.queuedCache.has(id)) {
            state.cacheHitTotal++
        } else {
            queue.enqueue(evolvedGroup)
            state.queuedTotal++
            if (state.queuedCache.size >= 10000000) {
                // The cache is too full and will exhaust memory soon (or the maximum allowed
                // Set size which is 2^24).
                // No good removing elements from the cache, because they still seem to count
                // against the Set size limit.
                // No good copying values into a new Set, because that takes too long (~3000ms).
                // Simplest thing is just throw away the cache and start again.
                state.queuedCache = new Set()
            }
            state.queuedCache.add(id)
        }
    }

    state.processedTotal++
    if (state.processedTotal % GROUPS_PER_HEARTBEAT === 0) {
        heartbeat(state)
    }

    //showSnapshot(state)

    return queue.length() > 0
}

// Return an array of groups, the results of applying each operator once
// to each formula/pair in the group.
function evolveGroup(group: FormulaGroup): FormulaGroup[] {

    const newGroups: FormulaGroup[] = []

    // For each formula in the group, apply each unary operator
    for (let i = 0; i < group.formulas.length; ++i) {
        const before = group.formulas.slice(0, i)
        const formula = group.formulas[i]
        const after = group.formulas.slice(i+1)

        const groups = applyUnaryOperators(settings.unaryOperators)(formula)
                .map(f => ({...group, formulas: [...before, f, ...after]}))
        newGroups.push(...groups)
    }

    // For each pair of formulas in the group, apply each binary operator
    if (group.formulas.length >= 2) {
        for (let i = 0; i < group.formulas.length - 1; ++i) {
            const prefix = group.formulas.slice(0, i)
            const formulaA = group.formulas[i]
            if (settings.preserveOrder) {
                const formulaB = group.formulas[i+1]
                const suffix = group.formulas.slice(i+2)

                const groups = applyBinaryOperators(settings.binaryOperators)(formulaA, formulaB)
                    .map(f => ({...group, formulas: [...prefix, f, ...suffix]}))
                newGroups.push(...groups)
            }
            else {
                for (let j = i+1; j < group.formulas.length; ++j) {
                    const between = group.formulas.slice(i+1, j)
                    const formulaB = group.formulas[j]
                    const after = group.formulas.slice(j+1)
                    const suffix = [...between, ...after]

                    const groups = applyBinaryOperators(settings.binaryOperators)(formulaA, formulaB)
                        .map(f => ({...group, formulas: [...prefix, f, ...suffix]}))
                    newGroups.push(...groups)
                }
            }
        }
    }
    return newGroups
}

function applyUnaryOperators(operators: UnaryOperator[]) {
    // return an array of the results of applying each operator to the formula(s)
    return function(formula: Formula): Formula[] {
        return operators
            .map(op => op.applyAll(formula))
            .flat()
            .filter(_ => _.value <= settings.valueLimit)
    }
}

function applyBinaryOperators(operators: BinaryOperator[]) {
    // return an array of the results of applying each operator to the formula(s)
    return function(formulaA: Formula, formulaB: Formula): Formula[] {
        const digits = [...formulaA.digits, ...formulaB.digits]
        if (digits.length > settings.digits.length || without(digits, settings.digits).length > 0) {
            return []
        }
        return operators
            .map(op => op.applyAll(formulaA, formulaB, settings.preserveOrder))
            .flat()
            .filter(_ => _.value <= settings.valueLimit)
    }
}


///// Utilities


function groupId(group: FormulaGroup) {
    const formulas = group.formulas.map(_ => _.text)
    if ( ! settings.preserveOrder) {
        formulas.sort()
    }
    return formulas.join(',')
}

///// Universe

const LEADING_ZERO = /(?<!\d)0\d/

function addSolutions(pool: FormulaMap, formulas: Formula[]) {
    // add formulas that qualify (whole numbers within the limit)
    formulas.forEach(formula => {
        if (formula
                && (formula.value >= 0)
                && (formula.value === Math.round(formula.value))
                && (settings.allowParens || ! formula.text.includes('('))
                && formula.value >= - settings.valueLimit && formula.value <= settings.valueLimit
                && ! LEADING_ZERO.test(formula.text)) {
            const value = formula.value
            if (pool[value]) {
                // replace complicated formulas with simpler ones
                const old = pool[value]
                if (formula.digits.length < old.digits.length
                    || formula.digits.length === old.digits.length && formula.text.length < old.text.length) {
                        pool[value] = formula
                }
            }
            else {
                pool[value] = formula
            }
        }
    })
}

function digitToFormula(digit: number): Formula {
    return {
        value: digit,
        text: String(digit),
        operator: null,
        digits: [digit]
    }
}

function without<T>(array: T[], remove: T[]) {
    return remove.reduce((acc, val) => {
        const i = acc.indexOf(val)
        if (i < 0) {
            return acc
        } else {
            const spliced = [...acc]
            spliced.splice(i, 1)
            return spliced
        }
    },
    array)
}


///// Output


function showSnapshot(state: State, showFormulas: boolean = false) {
    const processingTimeMs = getProcessingTime(state)
    const numbers = new Set<number>(Object.keys(state.solutions).map(Number))
    let formulaMap: FormulaTextMap | undefined
    if (showFormulas) {
        formulaMap = {}
        Object.values(state.solutions).forEach(({value, text}) => formulaMap![value] = text)
    }
    postAppMessage({
      snapshot: {
        runId: state.runId,
        processingTimeMs,
        queueSize: state.queue.length(),
        queuedTotal: state.queuedTotal,
        cacheSize: state.queuedCache.size,
        processedTotal: state.processedTotal,
        cacheHitTotal: state.cacheHitTotal,
        solutionCount: numbers.size,
        solutions: numbers,
        formulaMap,
      }})
}

function showMessage(message: string) {
    postAppMessage({
        message
    })
}

function clearMessages() {
    postAppMessage({
        clearMessages: true
    })
}

// Check progress, write a heartbeat log periodically.
// Can throw 'yield' or 'pause'
function heartbeat(state: State) {
    const now = new Date().getTime()
    const startTimestamp = state.currentStartTimestamp ?? now
    const elapsed = now - startTimestamp
    const {heartbeatMs, yieldMs} = settings

    if ( ! state.nextHeartbeat) {
        state.nextHeartbeat = 1
    }
    const nextHeartbeatTimestamp = startTimestamp + heartbeatMs * state.nextHeartbeat
    if (nextHeartbeatTimestamp < now) {
        showSnapshot(state)
        state.nextHeartbeat = Math.ceil(elapsed / heartbeatMs)
        // If we've done enough heartbeats, check if we need to pause
        if (settings.minHeartbeats < state.nextHeartbeat) {
            if (state.nextHeartbeat * settings.heartbeatSeconds > settings.maxDurationSeconds) {
                throw 'pause'
            }
        }
    }
    if ( ! state.nextYield) {
        state.nextYield = 1
    }
    const nextYieldTimestamp = startTimestamp + yieldMs * state.nextYield
    if (nextYieldTimestamp < now) {
        state.nextYield = Math.ceil(elapsed / yieldMs)
        throw 'yield'
    }
}

function postAppMessage(message: AppMessage) {
    postMessage(message)
}