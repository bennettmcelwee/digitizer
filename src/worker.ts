import { Formula, FormulaSet, FormulaTextMap, Options, Settings } from './types'
import { BinaryOperator, Operator, UnaryOperator, allOperators } from './operators'
import { AppMessage } from './app/page'

type FormulaMap = Record<number, Formula>

interface State {
    formulas: FormulaMap,
    [key: string]: any,
}

let state: State = {
    formulas: [],
    running: false,
}

let settings: Settings

export type WorkerMessage = {
    command: 'start'
    options: Options
} | {
    command: 'pause' | 'resume' | 'stop'
}

onmessage = function(e: MessageEvent<WorkerMessage>) {
    switch (e.data.command) {
        case 'start': {
            state = start(e.data.options)
            break;
        }
        case 'pause': {
            pause(state)
            break;
        }
        case 'resume': {
            resume(state)
            break;
        }
        case 'stop': {
            stop(state)
            break;
        }
    }
}

////////////////////

function start(options: Options) {
    clearMessages()
    settings = buildSettings(options)
    const state = buildInitialState()
    scheduleContinue(state)
    return state
}

function pause(state: State) {
    state.pause = true
}

function resume(state: State) {
    state.pause = false
    showMessage('Resuming')
    scheduleContinue(state)
}

function stop(state: State) {
    state.running = false
    showMessage('Resuming')
}

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
            state.lastMilestone = { round: state.lastMilestone.round + 1 }
        }
        showMessage('Finished (exhausted)')
        showFormulas(state)
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
            showMessage('Pausing')
            postAppMessage({
                status: 'paused'
            })
        }
        else if (ex === 'stop') {
            showMessage('Finished (stopped)')
            showFormulas(state)
            postAppMessage({
                status: 'idle'
            })
        }
        else if (ex === 'timeout') {
            showMessage('Finished (timed out)')
            showFormulas(state)
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

function buildInitialState() {
    const state: State = {
        running: true,
        lastMilestone: { round: 0 },
        startTimestamp: new Date().getTime(),
        formulas: {}
    }

    const digits = settings.digits ?? []
    // add a single set consisting of all the digits
    const initialSets: FormulaSet[] = [{ formulas: digits.map(digitToFormula) }]
    state.sets = initialSets
    state.setCounts = []
    state.allSetIds = new Set(initialSets.map(setId))

    return state
}

// return true if we need to keep going, false if we're finished
function doRound(state: State) {

    state.setsInProgress = state.setsInProgress ?? []

    for (let i = state.lastMilestone.stage?.sets?.last ?? 0; i < state.sets.length; ) {
        const iterationSets: FormulaSet[] = []
        for (let j = 0; j < 100 && i < state.sets.length; ++j) {
            iterationSets.push(...evolveSet(state.sets[i]))
            ++i
        }
        // add them one by one if they haven't already been added
        for (const set of iterationSets) {
            const id = setId(set)
            if ( ! state.allSetIds.has(id)) {
                state.setsInProgress.push(set)
                state.allSetIds.add(id)
            }
        }
        // or just add them all
        // state.setsInProgress.push(...iterationSets)

        state.lastMilestone.stage = {
            sets: {
                last: i,
                fraction: (i+1) / state.sets.length
            }
        }
        heartbeat(state)
    }

    // done calculations for this round
    state.lastMilestone.stage = {}
    state.setCounts.push(state.sets.length)
    state.sets = state.setsInProgress
    state.setsInProgress = []

    for (const set of state.sets) {
        if (set.formulas.length == 1 || ! settings.useAllDigits) {
            addFormulas(state.formulas, set.formulas)
        }
    }

    showMilestone(state)
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


function timestamp() {
    return ((new Date().getTime() - state.startTimestamp) / 1000).toFixed(3)
}

function setId(set: FormulaSet) {
    return set.formulas.map(_ => _.text).sort().join(',')
}

///// Universe

const LEADING_ZERO = /(?<!\d)0\d/

function addFormulas(pool: FormulaMap, formulas: [Formula]) {
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


function showMilestone(state: State, label = getLabel(state)) {
    const time = timestamp()
    const numbers = Object.values(state.formulas).map(_ => _.value)
    console.log(`Milestone [${label}]`)//, numbers)
    console.log(time, label, 'Numbers', numbers.length)
    postAppMessage({
      snapshot: {
        time,
        label,
        numberCount: numbers.length,
        setCounts: state.setCounts,
        setCount: state.sets.length,
        setCurrent: state.lastMilestone.stage.sets?.last ?? 1,
        numbers,
      }})
}

function showSnapshot(state: State, label = getLabel(state)) {
    const time = timestamp()
    const setCount = state.sets.length
    const numberCount = Object.keys(state.formulas).length
    console.log(time, label , 'Sets', setCount, 'Numbers', numberCount)
    postAppMessage({
      snapshot: {
        time,
        label,
        numberCount,
        setCounts: state.setCounts,
        setCount: state.sets.length,
        setCurrent: state.lastMilestone.stage.sets?.last ?? 1,
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

function showFormulas(state: State, label = getLabel(state)) {
    const time = timestamp()
    const numberCount = Object.keys(state.formulas).length
    const formulaMap: FormulaTextMap = {}
    Object.entries(state.formulas).forEach(([key, {value, text}]) => formulaMap[value] = text)

    console.log(time, label , 'Numbers', numberCount)
    postAppMessage({
      snapshot: {
        time,
        label,
        numberCount,
        setCounts: state.setCounts,
        setCount: state.sets.length,
        formulaMap,
      }})
}

// todo
function showDebug(state: State, label: string) {
    // const sortedFormuas = state.formulas
    //     .in_place_sort((a, b) => a.value - b.value)
    // console.log(timestamp(), label + '\n', sortedWholes.map(formula => formula.value + ' = ' + formula.text).join('\n '))
    // console.log('(objects)', sortedWholes)
    // console.log('(all)', Object.keys(universe)
    //     .map(key => universe[key])
    //     .map(formula => formula.value)
    //     .sort((a, b) => a - b))
}

function getLabel(state: State) {
    const currentRound = state.lastMilestone.round + 1
    const stage = state.lastMilestone.stage?.sets
        ? 'sets ' + Math.round(state.lastMilestone.stage.sets.fraction * 100) + '%'
        : ''
    return `Round ${currentRound} ${stage}`
}

// Check progress, write a heartbeat log periodically.
function heartbeat(state: State) {
    const now = new Date().getTime()
    const startTimestamp = state.startTimestamp
    const {heartbeatMs, yieldMs} = settings
    const elapsed = now - startTimestamp

    if ( ! state.nextHeartbeat) {
        state.nextHeartbeat = 1
    }
    const nextHeartbeatTimestamp = startTimestamp + heartbeatMs * state.nextHeartbeat
    if (nextHeartbeatTimestamp < now) {
        showSnapshot(state)
        state.nextHeartbeat = Math.ceil((elapsed) / heartbeatMs)
        // If we've done enough heartbeats, check if we need to wind up
        if (settings.minHeartbeats < state.nextHeartbeat) {
            if (state.nextHeartbeat * settings.heartbeatSeconds > settings.maxDurationSeconds) {
                // We should windup before next heartbeat
                throw 'timeout'
            }
        }
    }
    if ( ! state.nextYield) {
        state.nextYield = 1
    }
    const nextYieldTimestamp = startTimestamp + yieldMs * state.nextYield
    if (nextYieldTimestamp < now) {
        state.nextYield = Math.ceil((elapsed) / yieldMs)
        throw 'yield'
    }
}

function postAppMessage(message: AppMessage) {
    postMessage(message)
}