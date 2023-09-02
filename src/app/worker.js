importScripts('//cdnjs.cloudflare.com/ajax/libs/ramda/0.29.0/ramda.min.js')

/*
Types:
Set = { formulas: [Formula] }
Formula = { value: number, text: string, operator: Object, digits: [number] }
 */
onmessage = function(e) {
  if (e.data.init) {
    global.state = init(e.data.init.options)
  }
  if (e.data.start) {
    global.state = start(e.data.start.options)
  }
  else if (e.data.pause) {
    pause(global.state)
  }
  else if (e.data.resume) {
    resume(global.state)
  }
  else if (e.data.stop) {
    stop(global.state)
  }
}

if (typeof global === 'undefined') {
    var global = {}
}

const DEFAULT_SETTINGS = {
    // Parameters
    digitString: (new Date().getFullYear()).toString(),
    useAllDigits: true,
    symbols: ['( )', '+', '-', '×', '÷', '&', '!', '^'],
    // Display
    displayLimit: 100,
    quiet: false,
    heartbeatSeconds: 1,
    statusSeconds: 1,
    // Internals
    valueLimit: 10000,
    // Timing
    yieldSeconds: 2,
    maxDurationSeconds: 10,
    minHeartbeats: 1
}


////////////////////

function init() {
    const settings = {
        ...DEFAULT_SETTINGS,
        allOperators: [
            {
                symbol: '( )',
                description: 'Group expressions, e.g. 2×(3+4) = 14',
            },
            ...combineDescriptions(allOperators)],
    }
    // Post initial settings
    console.log({ settings })
    postMessage({ settings })
}

function combineDescriptions(operators) {
    return R.toPairs(R.groupBy(_ => _.symbol)(operators))
        .map(([symbol, os]) => ({
            symbol,
            description: os.map(_ => _.description).join('\n')
        }))
}

function start(settings) {
    clearMessages()
    global.settings = buildSettings(settings)
    const state = buildInitialState()
    scheduleContinue(state)
    return state
}

function pause(state) {
    state.pause = true
}

function resume(state) {
    state.pause = false
    showMessage('Resuming')
    scheduleContinue(state)
}

function stop(state) {
    state.running = false
    showMessage('Resuming')
}

function scheduleContinue(state) {
    setTimeout(doContinue, 0, state)
}

function doContinue(state) {
    try {
        if ( ! state.running) {
            throw 'stop'
        }
        if (state.pause) {
            throw 'pause'
        }
        postMessage({
            status: 'running'
        })
        let processing = true
        while (processing) {
            processing = doRound(state)
            state.lastMilestone = { round: state.lastMilestone.round + 1 }
        }
        showMessage('Finished (exhausted)')
        showFormulas(state)
        postMessage({
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
            postMessage({
                status: 'paused'
            })
        }
        else if (ex === 'stop') {
            showMessage('Finished (stopped)')
            showFormulas(state)
            postMessage({
                status: 'idle'
            })
        }
        else if (ex === 'timeout') {
            showMessage('Finished (timed out)')
            showFormulas(state)
            postMessage({
                status: 'idle'
            })
        }
        else {
            throw ex
        }
    }
}

function buildSettings(settings) {
    const operators = allOperators.filter(operator => settings.symbols.includes(operator.symbol))
    return {
        ...settings,
        allowParens: settings.symbols.includes('( )'),
        heartbeatMs: settings.heartbeatSeconds * 1000,
        yieldMs: settings.yieldSeconds * 1000,
        digits: settings.digitString.split('').map(Number),
        operators,
        unaryOperators: operators.filter(op => op instanceof UnaryOperator),
        binaryOperators: operators.filter(op => op instanceof CommutativeOperator || op instanceof NoncommutativeOperator)
    }
}

function buildInitialState() {
    const state = {
        running: true,
        lastMilestone: { round: 0 },
        startTimestamp: new Date().getTime(),
        formulas: {}
    }

    const digits = global.settings.digits
    // add a single set consisting of all the digits
    const initialSets = [{ formulas: digits.map(digitsToFormula) }]
    state.sets = initialSets
    state.setCounts = []
    state.allSetIds = new Set(initialSets.map(setId))

    return state
}

// return true if we need to keep going, false if we're finished
function doRound(state) {

    state.setsInProgress = state.setsInProgress ?? []

    for (let i = state.lastMilestone.stage?.sets?.last ?? 0; i < state.sets.length; ) {
        const iterationSets = []
        for (let j = 0; j < 100 && i < state.sets.length; ++j) {
            iterationSets.push(...evolveSet(state.sets[i]))
            ++i
        }
        // add them one by one if they haven't already been added
        for (set of iterationSets) {
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

    for (set of state.sets) {
        if (set.formulas.length == 1 || ! global.settings.useAllDigits) {
            addFormulas(state.formulas, set.formulas)
        }
    }

    showMilestone(state)
    return (state.sets.length > 0)
}

// Return an array of sets, the results of applying each operator once
// to each formula/pair in the set.
function evolveSet(set) {

    const newSets = []

    // For each formula in the set, apply each unary operator
    for (let i = 0; i < set.formulas.length; ++i) {
        const formula = set.formulas[i]
        const newSet = {...set, formulas: set.formulas.toSpliced(i, 1)}

        const sets = applyOperators(global.settings.unaryOperators)(formula)
                .map(f => ({...newSet, formulas: [f, ...newSet.formulas]}))

        newSets.push(...sets)
    }

    // For each pair of formulas in the set, apply each binary operator
    if (set.formulas.length >= 2) {
        for (let i = 0; i < set.formulas.length - 1; ++i) {
            const iFormula = set.formulas[i]
            for (let j = i+1; j < set.formulas.length; ++j) {
                const jFormula = set.formulas[j]
                const newSet = {
                    ...set,
                    // j > i so remove j then i
                    formulas: set.formulas.toSpliced(j, 1).toSpliced(i, 1)
                }
                newSets.push(
                    ...applyOperators(global.settings.binaryOperators)(iFormula, jFormula)
                        .map(f => ({...newSet, formulas: [f, ...newSet.formulas]}))
                )
            }
        }
    }

    return newSets
}

function applyOperators(operators) {
    // return an array of the results of applying each operator to the formula(s)
    return function(formulaA, formulaB) {
        if (formulaB) {
            const digits = [...formulaA.digits, ...formulaB.digits]
            if (without(digits, global.settings.digits).length > 0) {
                return []
            }
        }
        return operators
            .map(op => op.applyAll(formulaA, formulaB))
            .flat()
            .filter(f => !!f) // remove nulls
    }
}


///// Utilities


function timestamp() {
    return ((new Date().getTime() - global.state.startTimestamp) / 1000).toFixed(3)
}

// https://stackoverflow.com/a/64904542
function generatePermutations(list, size=list.length) {
    if (size > list.length) return [];
    else if (size == 1) return list.map(d=>[d]);
    return list.flatMap(d => generatePermutations(list.filter(a => a !== d), size - 1).map(item => [d, ...item]));
}

function setId(set) {
    return set.formulas.map(_ => _.text).sort().join(',')
}

///// Universe

const LEADING_ZERO = /(?<!\d)0\d/

function addFormulas(pool, formulas) {
    // add formulas that qualify (whole numbers within the limit)
    formulas.forEach(formula => {
        if (formula
                && (formula.value >= 0)
                && (formula.value === Math.round(formula.value))
                && (global.settings.allowParens || ! formula.text.includes('('))
                && formula.value >= - global.settings.valueLimit && formula.value <= global.settings.valueLimit
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

// e.g. 42 => {value: 42, text: '42', etc}
// e.g. [1, 2] => {value: 12, text: '12', etc}
function digitsToFormula(digits) {
    const digitArray = Array.isArray(digits) ? digits : [digits]
    const digitString = digitArray.join('')
    return {
        value: Number(digitString),
        text: digitString,
        operator: null,
        digits: digitArray
    }
}

const EPSILON = 1e-9

function quantise(number) {
    const integer = Math.round(number)
    const delta = Math.abs(number - integer)
    return (delta < EPSILON ? integer : number)
}

function without(array, remove) {
    return remove.reduce((acc, val) => {
        const i = acc.indexOf(val)
        return (i < 0) ? acc : acc.toSpliced(i, 1)
    },
    array)
}


///// Output


function showMilestone(state, label = getLabel(state)) {
    const time = timestamp()
    const numbers = R.map(R.path(['value']))(Object.values(state.formulas))
    console.log(`Milestone [${label}]`)//, numbers)
    console.log(time, label, 'Numbers', numbers.length)
    postMessage({
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

function showSnapshot(state, label = getLabel(state)) {
    const time = timestamp()
    const setCount = state.sets.length
    const numberCount = Object.keys(state.formulas).length
    console.log(time, label , 'Sets', setCount, 'Numbers', numberCount)
    postMessage({
      snapshot: {
        time,
        label,
        numberCount,
        setCounts: state.setCounts,
        setCount: state.sets.length,
        setCurrent: state.lastMilestone.stage.sets?.last ?? 1,
      }})
}

function showMessage(message) {
    postMessage({
        message
    })
}

function clearMessages() {
    postMessage({
        clearMessages: true
    })
}

function showFormulas(state, label = getLabel(state)) {
    const time = timestamp()
    const numberCount = Object.keys(state.formulas).length
    const formulaMap = {}
    Object.entries(state.formulas).forEach(([key, {value, text}]) => formulaMap[value] = text)

    console.log(time, label , 'Numbers', numberCount)
    postMessage({
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
function showDebug(state, label) {
    const sortedFormuas = state.formulas
        .in_place_sort((a, b) => a.value - b.value)
    console.log(timestamp(), label + '\n', sortedWholes.map(formula => formula.value + ' = ' + formula.text).join('\n '))
    // console.log('(objects)', sortedWholes)
    // console.log('(all)', Object.keys(universe)
    //     .map(key => universe[key])
    //     .map(formula => formula.value)
    //     .sort((a, b) => a - b))
}

function getLabel(state) {
    const currentRound = state.lastMilestone.round + 1
    const stage = state.lastMilestone.stage?.sets
        ? 'sets ' + Math.round(state.lastMilestone.stage.sets.fraction * 100) + '%'
        : ''
    return `Round ${currentRound} ${stage}`
}

// Check progress, write a heartbeat log periodically.
function heartbeat(state) {
    const now = new Date().getTime()
    const startTimestamp = state.startTimestamp
    const {heartbeatMs, yieldMs} = global.settings
    const elapsed = now - startTimestamp

    if ( ! state.nextHeartbeat) {
        state.nextHeartbeat = 1
    }
    const nextHeartbeatTimestamp = startTimestamp + heartbeatMs * state.nextHeartbeat
    if (nextHeartbeatTimestamp < now) {
        showSnapshot(state)
        state.nextHeartbeat = Math.ceil((elapsed) / heartbeatMs)
        // If we've done enough heartbeats, check if we need to wind up
        if (global.settings.minHeartbeats < state.nextHeartbeat) {
            if (state.nextHeartbeat * global.settings.heartbeatSeconds > global.settings.maxDurationSeconds) {
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


///// Operators


// Compare two operators' precedence, return -ve, 0 or +ve
function opCmp(opA, opB) {
    return (opA?.precedence ?? 99) - (opB?.precedence ?? 99)
}

// Return the text for the formula with brackets added if necessary
// to bind loosely with the given operator
function bindLoose(operator, formula) {
    return opCmp(formula.operator, operator) < 0 ? `(${formula.text})` : formula.text
}
// Return the text for the formula with brackets added if necessary
// to bind tightly with the given operator
function bindTight(operator, formula) {
    return opCmp(formula.operator, operator) <= 0 ? `(${formula.text})` : formula.text
}


///// Operators


class Operator {
    constructor(source) {
        Object.assign(this, source)
    }
}

class UnaryOperator extends Operator {
    apply(formulaA) {
        const value = this.applyValue(formulaA)
        return value === null ? null : {
            value,
            text: this.applyFormula(formulaA),
            operator: this,
            digits: formulaA.digits
        }
    }
    applyAll(formulaA) {
        return [this.apply(formulaA)]
    }
}

class NoncommutativeOperator extends Operator {
    apply(formulaA, formulaB) {
        const value = this.applyValues(formulaA, formulaB)
        return value === null ? null : {
            value,
            text: this.applyFormulas(formulaA, formulaB),
            operator: this,
            digits: [...formulaA.digits, ...formulaB.digits]
        }
    }
    applyAll(formulaA, formulaB) {
        return [this.apply(formulaA, formulaB), this.apply(formulaB, formulaA)]
    }
}

class CommutativeOperator extends Operator {
    apply(formulaA, formulaB) {
        return {
            value: this.applyValues(formulaA, formulaB),
            text: this.applyFormulas(formulaA, formulaB),
            operator: this,
            digits: [...formulaA.digits, ...formulaB.digits]
        }
    }
    applyAll(formulaA, formulaB) {
        return [this.apply(formulaA, formulaB)]
    }
}

const concatenateValues = new NoncommutativeOperator({
    symbol: '|',
    description: 'Concatenate two expressions, e.g. (2+3)|0 = 50',
    precedence: 0,
    applyValues(formulaA, formulaB) {
        // can slap any old values together as long as they don't both have points
        if (formulaB.value >= 0 &&
            ! (formulaA.text.includes('.') && formulaB.text.includes('.'))
        ) {
            const value = Number(String(formulaA.value) + String(formulaB.value))
            return value < global.settings.valueLimit ? value : null
        }
        return null
    },
    applyFormulas(formulaA, formulaB) { return bindLoose(this, formulaA) + '|' + bindTight(this, formulaB) }
})

const add = new CommutativeOperator({
    symbol: '+',
    description: 'Add two expressions, e.g. 23+(4×3) = 35',
    precedence: 1,
    applyValues(formulaA, formulaB) { return formulaA.value + formulaB.value },
    applyFormulas(formulaA, formulaB) { return bindLoose(this, formulaA) + '+' + bindLoose(this, formulaB) }
})

const subtract = new NoncommutativeOperator({
    symbol: '-',
    description: 'Subtract an expression from another, e.g. 23-(4×3) = 11',
    precedence: 1,
    applyValues(formulaA, formulaB) { return formulaA.value - formulaB.value },
    applyFormulas(formulaA, formulaB) { return bindLoose(this, formulaA) + '-' + bindTight(this, formulaB) }
})

const multiply = new CommutativeOperator({
    symbol: '×',
    description: 'Multiply two expressions, e.g. 3×(4+3) = 21',
    precedence: 2,
    applyValues(formulaA, formulaB) { return formulaA.value * formulaB.value },
    applyFormulas(formulaA, formulaB) { return bindLoose(this, formulaA) + '×' + bindLoose(this, formulaB) }
})

const divide = new NoncommutativeOperator({
    symbol: '÷',
    description: 'Divide an expression by another, e.g. 21÷(4+3) = 3',
    precedence: 2,
    applyValues(formulaA, formulaB) { return formulaB.value ? quantise(formulaA.value / formulaB.value) : null },
    applyFormulas(formulaA, formulaB) { return bindLoose(this, formulaA) + '÷' + bindTight(this, formulaB) }
})

const power = new NoncommutativeOperator({
    symbol: '^',
    description: 'Raise an expression to the power of another, e.g. (1+2)^(2+2) = 81',
    precedence: 3,
    applyValues(formulaA, formulaB) {
        if (formulaA.value == 0 && formulaB.value == 0) {
            return null;
        }
        const value = Math.pow(formulaA.value, formulaB.value)
        return value < global.settings.valueLimit ? quantise(value) : null
    },
    applyFormulas(formulaA, formulaB) { return bindTight(this, formulaA) + '^' + bindLoose(this, formulaB) }
})

const squareRoot = new UnaryOperator({
    symbol: '√',
    description: 'Take the square root of an expression, e.g. √(21+4) = 5',
    precedence: 4,
    applyValue(formulaA) { return formulaA.value >= 0 ? quantise(Math.sqrt(formulaA.value)) : null },
    applyFormula(formulaA) { return '√' + bindLoose(this, formulaA) }
})

const factorial = new UnaryOperator({
    symbol: '!',
    description: 'Take the factorial of an expression, e.g. (2+3)! = 120',
    precedence: 5,
    applyValue(formulaA) { return this.values[formulaA.value] ?? null },
    applyFormula(formulaA) { return bindLoose(this, formulaA) + '!' },
    values: {0: 1, 3: 6, 4: 24, 5: 120, 6: 720, 7: 5040, 8: 40320, 9: 362880},
})

const negate = new UnaryOperator({
    symbol: '-',
    description: 'Negate an expression, e.g. -(2+3) = -5',
    precedence: 6,
    // can't negate an already negated value, because that's pointless
    applyValue(formulaA) { return formulaA.operator?.symbol != '-' ? -formulaA.value : null },
    applyFormula(formulaA) { return '-' + bindLoose(this, formulaA) }
})

const concatenateDigits = new NoncommutativeOperator({
    symbol: '&',
    description: 'Concatenate two numbers, e.g. 1&23 = 123',
    precedence: 7,
    applyValues(formulaA, formulaB) {
        // can prepend a digit to a digit or concatenated formula or point formula
        // rules for & and . are carefully structured so we can build up arbitrary fractions
        // this is why we allow numbers like 04 and 00
        if (formulaA.value >= 0 && formulaB.value >= 0 &&
            (!formulaA.operator) &&
            (!formulaB.operator || formulaB.operator?.symbol === '&' || formulaB.operator?.symbol === '.')
        ) {
            const value = Number(formulaA.text + formulaB.text)
            return value < global.settings.valueLimit ? value : null
        }
        return null
    },
    applyFormulas(formulaA, formulaB) { return formulaA.text + formulaB.text }
})

const point = new UnaryOperator({
    symbol: '.',
    description: 'Allow decimal points, e.g. 2.3, or .45 = 0.45',
    precedence: 7,
    applyValue(formulaA) {
        // can prepend a point to a digit or concatenated formula as long as it doesn't already have a point
        if (!formulaA.operator || formulaA.operator?.symbol === '&') {
            return formulaA.text.includes('.') ? null : Number('.' + formulaA.text)
        }
        return null
    },
    applyFormula(formulaA) { return '.' + formulaA.text }
})

const allOperators = [add, subtract, multiply, divide, concatenateDigits, concatenateValues, point, factorial, negate, power, squareRoot]


/////
