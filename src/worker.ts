import { Formula, FormulaSet, FormulaTextMap, Options, Settings } from './types'
import { BinaryOperator, Operator, UnaryOperator, allOperators } from './operators'
import { AppMessage } from './app/page'

type FormulaMap = Record<number, Formula>

interface State {
    runId: number,
    running: boolean,
    pause: boolean,
    // round
    progress?: {
        round: number,
        processed: number,
        sets: FormulaSet[],
    } | null,
    // work done
    processingTimeMs: number;
    completedRounds: number,
    processedSetCount: number,
    allSetIds: Set<string>,
    // results
    sets: FormulaSet[],
    formulas: FormulaMap,

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
            processing = doRound(state)
        }
        showMessage('Finished (exhausted)')
        showSnapshot(state, true)
        postAppMessage({
            status: 'idle'
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
    // add a single set consisting of all the digits
    const sets = [{ formulas: digits.map(digitToFormula) }]
    const state = {
        runId: new Date().getTime(),
        running: true,
        pause: false,
        processingTimeMs: 0,
        completedRounds: 0,
        processedSetCount: 0,
        allSetIds: new Set(sets.map(setId)),
        sets,
        formulas: {},
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

// return true if we need to keep going, false if we're finished
function doRound(state: State) {

    startProcessing(state)
    if (!state.progress) {
        state.progress = {
            round: state.completedRounds + 1,
            sets: [],
            processed: 0,
        }
    }

    for (let i = state.progress.processed; i < state.sets.length; ) {
        const iterationSets: FormulaSet[] = []
        for (let j = 0; j < 100 && i < state.sets.length; ++j) {
            iterationSets.push(...evolveSet(state.sets[i]))
            ++i
        }
        // add them one by one if they haven't already been added
        for (const set of iterationSets) {
            const id = setId(set)
            if ( ! state.allSetIds.has(id)) {
                state.progress.sets.push(set)
                state.allSetIds.add(id)
            }
            state.processedSetCount++
        }
        state.progress.processed = i

        heartbeat(state)
    }

    // done calculations for this round
    state.sets = state.progress.sets
    state.completedRounds++
    state.progress = null

    for (const set of state.sets) {
        if (set.formulas.length == 1 || ! settings.useAllDigits) {
            addFormulas(state.formulas, set.formulas)
        }
    }

    showSnapshot(state)
    return (state.sets.length > 0)
}

// Return an array of sets, the results of applying each operator once
// to each formula/pair in the set.
function evolveSet(set: FormulaSet): FormulaSet[] {

    const newSets: FormulaSet[] = []

    // For each formula in the set, apply each unary operator
    for (let i = 0; i < set.formulas.length; ++i) {
        const formula = set.formulas[i]
        const spliced = [...set.formulas]
        spliced.splice(i, 1)
        const splicedSet = {...set, formulas: spliced}

        const sets = applyUnaryOperators(settings.unaryOperators)(formula)
                .map(f => ({...splicedSet, formulas: [f, ...splicedSet.formulas]}))

        newSets.push(...sets)
    }

    // For each pair of formulas in the set, apply each binary operator
    if (set.formulas.length >= 2) {
        for (let i = 0; i < set.formulas.length - 1; ++i) {
            const iFormula = set.formulas[i]
            for (let j = i+1; j < set.formulas.length; ++j) {
                const jFormula = set.formulas[j]
                const spliced = [...set.formulas]
                // j > i so remove j then i
                spliced.splice(j, 1)
                spliced.splice(i, 1)
                const splicedSet = {
                    ...set,
                    formulas: spliced
                }
                newSets.push(
                    ...applyBinaryOperators(settings.binaryOperators)(iFormula, jFormula)
                        .map(f => ({...splicedSet, formulas: [f, ...splicedSet.formulas]}))
                )
            }
        }
    }

    return newSets
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
        if (without(digits, settings.digits).length > 0) {
            return []
        }
        return operators
            .map(op => op.applyAll(formulaA, formulaB))
            .flat()
            .filter(_ => _.value <= settings.valueLimit)
    }
}


///// Utilities


function setId(set: FormulaSet) {
    return set.formulas.map(_ => _.text).sort().join(',')
}

///// Universe

const LEADING_ZERO = /(?<!\d)0\d/

function addFormulas(pool: FormulaMap, formulas: Formula[]) {
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
    const numbers = new Set<number>(Object.keys(state.formulas).map(Number))
    let formulaMap: FormulaTextMap | undefined
    if (showFormulas) {
        formulaMap = {}
        Object.values(state.formulas).forEach(({value, text}) => formulaMap![value] = text)
    }
    postAppMessage({
      snapshot: {
        runId: state.runId,
        processingTimeMs,
        currentRound: state.progress?.round,
        currentSetCount: state.sets.length,
        currentSetProcessed: state.progress?.processed ?? 0,
        processedSetCount: state.processedSetCount,
        numberCount: numbers.size,
        numbers,
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