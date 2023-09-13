// Copyright 2023 Bennett McElwee. All rights reserved.
import { Formula } from './types'


// Compare two operators' precedence, return -ve, 0 or +ve
function opCmp(opA: OperatorImpl | null, opB: OperatorImpl | null) {
    return (opA?.precedence ?? 99) - (opB?.precedence ?? 99)
}

// Return the text for the formula with brackets added if necessary
// to bind loosely with the given operator
function bindLoose(operator: OperatorImpl, formula: Formula) {
    return opCmp(formula.operator, operator) < 0 ? `(${formula.text})` : formula.text
}
// Return the text for the formula with brackets added if necessary
// to bind tightly with the given operator
function bindTight(operator: OperatorImpl, formula: Formula) {
    return opCmp(formula.operator, operator) <= 0 ? `(${formula.text})` : formula.text
}


///// Operators

export interface Operator {
    symbol: string,
    description: string,
    precedence: number,
}

class OperatorImpl implements Operator {
    symbol: string;
    description: string;
    precedence: number;
    constructor({symbol, description, precedence}: Operator) {
        this.symbol = symbol
        this.description = description
        this.precedence = precedence
    }
}

interface UnaryOperatorType extends Operator {
    applyValue: (formula: Formula) => number | null;
    applyFormula: (formula: Formula) => string;
}

export class UnaryOperator extends OperatorImpl {
    applyValue: (formula: Formula) => number | null;
    applyFormula: (formula: Formula) => string;
    constructor({symbol, description, precedence, applyValue, applyFormula}: UnaryOperatorType) {
        super({symbol, description, precedence})
        this.applyValue = applyValue
        this.applyFormula = applyFormula
    }
    applyAll(formula: Formula) {
        return [this.apply(formula)].filter(_ => !!_) as Formula[]
    }
    private apply(formula: Formula): Formula | null {
        const value = this.applyValue(formula)
        return value === null ? null : {
            value,
            text: this.applyFormula(formula),
            operator: this,
            digits: formula.digits
        }
    }
}

interface BinaryOperatorType extends Operator {
    applyValues: (formulaA: Formula, formulaB: Formula) => number | null;
    applyFormulas: (formulaA: Formula, formulaB: Formula) => string;
}

export abstract class BinaryOperator extends OperatorImpl {
    applyValues: (formulaA: Formula, formulaB: Formula) => number | null;
    applyFormulas: (formulaA: Formula, formulaB: Formula) => string;
    constructor({symbol, description, precedence, applyValues, applyFormulas}: BinaryOperatorType) {
        super({symbol, description, precedence})
        this.applyValues = applyValues
        this.applyFormulas = applyFormulas
    }
    abstract applyAll(formulaA: Formula, formulaB: Formula, preserveOrder: boolean): Formula[]
    protected apply(formulaA: Formula, formulaB: Formula): Formula | null {
        const value = this.applyValues(formulaA, formulaB)
        return value === null ? null : {
            value,
            text: this.applyFormulas(formulaA, formulaB),
            operator: this,
            digits: [...formulaA.digits, ...formulaB.digits]
        }
    }
}

class NoncommutativeOperator extends BinaryOperator {
    applyAll(formulaA: Formula, formulaB: Formula, preserveOrder: boolean): Formula[] {
        const applied = preserveOrder ?
            [this.apply(formulaA, formulaB)] :
            [this.apply(formulaA, formulaB), this.apply(formulaB, formulaA)]
        return applied.filter(_ => !!_) as Formula[]
    }
}

class CommutativeOperator extends BinaryOperator {
    applyAll(formulaA: Formula, formulaB: Formula, preserveOrder: boolean): Formula[] {
        const applied = [this.apply(formulaA, formulaB)]
        return applied.filter(_ => !!_) as Formula[]
    }
}

const concatenateValues = new NoncommutativeOperator({
    symbol: '|',
    description: 'Concatenate two expressions, e.g. (2+3) | 0 = 50',
    precedence: 0,
    applyValues(formulaA: Formula, formulaB: Formula) {
        // can slap any old values together as long as they don't both have points
        if (formulaB.value >= 0 &&
            ! (formulaA.text.includes('.') && formulaB.text.includes('.'))
        ) {
            return Number(String(formulaA.value) + String(formulaB.value))
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
        return Math.pow(formulaA.value, formulaB.value)
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
    applyValue(formulaA) {
        const factorials: {[key: number]: number} = {
            0: 1, 3: 6, 4: 24, 5: 120, 6: 720, 7: 5040, 8: 40320, 9: 362880
        }
        return factorials[formulaA.value] ?? null
    },
    applyFormula(formulaA) { return bindLoose(this, formulaA) + '!' },
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
    description: 'Concatenate two numbers, e.g. 1 & 23 = 123',
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
            return value
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

const EPSILON = 1e-9

function quantise(number: number) {
    const integer = Math.round(number)
    const delta = Math.abs(number - integer)
    return (delta < EPSILON ? integer : number)
}

export const allOperators = [add, subtract, multiply, divide, concatenateDigits, concatenateValues, point, factorial, negate, power, squareRoot]
