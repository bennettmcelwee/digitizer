import { allOperators } from "./operators"
import { Formula } from "./types"

const [add, subtract, multiply, divide, concatenateDigits, concatenateValues, point, factorial, negate, power, squareRoot] = allOperators

function digitToFormula(digit: number): Formula {
    return {
        value: digit,
        text: String(digit),
        operator: null,
        digits: [digit]
    }
}

const f0 = digitToFormula(0)
const f2 = digitToFormula(2)
const f3 = digitToFormula(3)
const f7 = digitToFormula(7)

const f2x3 = {
    value: 6,
    text: '2×3',
    operator: multiply,
    digits: [2, 3],
}
const f3x2 = {
    value: 6,
    text: '3×2',
    operator: multiply,
    digits: [3, 2],
}

describe('multiply', () => {
    it('has the right symbol', () => {
        expect(multiply.symbol === '×')
    })
    it('multiplies digits preserving order', () => {
        const result = multiply.applyAll(f2, f3, true)
        expect(result).toEqual([f2x3])
    })
    it('multiplies digits', () => {
        const result = multiply.applyAll(f2, f3, false)
        expect(result).toEqual([f2x3])
    })
    it('multiplies formulas', () => {
        const result = multiply.applyAll(f2x3, f3, false)
        expect(result).toEqual([{
            value: 18,
            text: '2×3×3',
            operator: multiply,
            digits: [2, 3, 3],
        }])
    })
})

describe('subtract', () => {
    it('has the right symbol', () => {
        expect(subtract.symbol === '-')
    })
    it('subtracts digits preserving order', () => {
        const result = subtract.applyAll(f7, f3, true)
        expect(result).toEqual([{
            value: 4,
            text: '7-3',
            operator: subtract,
            digits: [7, 3],
        }])
    })
    it('subtracts digits', () => {
        const result = subtract.applyAll(f7, f3, false)
        expect(result).toEqual([{
            value: 4,
            text: '7-3',
            operator: subtract,
            digits: [7, 3],
        }, {
            value: -4,
            text: '3-7',
            operator: subtract,
            digits: [3, 7],
        }])
    })
})
