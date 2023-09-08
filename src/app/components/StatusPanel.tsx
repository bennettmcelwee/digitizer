import { FormulaTextMap, Options, Snapshot, Status } from '@/types';
import React, { useEffect, useState } from 'react';

interface StatusPanelProps {
    options: Options,
    status: Status,
    snapshot?: Snapshot,
}
const StatusPanel = ({ options, status, snapshot }: StatusPanelProps) => {
    const [extraLimit, setExtraLimit] = useState(0)
    const [displayNumbers, setDisplayNumbers] = useState<Set<number>>(new Set())
    const [displayNumbersRunId, setDisplayNumbersRunId] = useState<number>()
    useEffect(() => {
        if (snapshot?.numbers) {
            if (snapshot.runId !== displayNumbersRunId) {
                setDisplayNumbers(snapshot.numbers)
                setDisplayNumbersRunId(snapshot.runId)
            } else {
                setDisplayNumbers(current => {
                    const updated = new Set(current)
                    for (const n of snapshot.numbers!.values()) {
                        updated.add(n)
                    }
                    return updated
                })
            }
        }
    }, [displayNumbersRunId, snapshot?.numbers, snapshot?.runId])

    useEffect(() => {
        setExtraLimit(0)
    }, [snapshot?.runId])

    return (
    <section className="p-4 border rounded-lg mt-2">
        {options &&
            <p>Making numbers with digits{' '}
                {options.digitString.split('').join(' ')}
                {' '}and symbols {options.symbols?.join(' ')}{' '}
                for {options.maxDurationSeconds} seconds
            </p>
        }

        {snapshot &&
            <>
                <div>Processing time: {formatTimestamp(snapshot.processingTimeMs)}</div>
                {status === 'running' && (
                    snapshot.currentRound ? (
                        <div>Processing round {snapshot.currentRound}{' '}
                            ({Math.round((snapshot.currentSetProcessed ?? 0) / snapshot.currentSetCount * 100)}%){' '}
                            ({(snapshot.currentSetProcessed ?? 0).toLocaleString()} / {snapshot.currentSetCount.toLocaleString()} candidates)
                        </div>
                    ) : (
                        <div>Processing</div>
                    )
                )}
                {status === 'paused' && (
                    <div className="text-orange-400 dark:text-orange-400">Paused</div>
                )}
                {status === 'idle' && (
                    <div>Idle</div>
                )}
                {status === 'done' && (
                    <div className="text-green-600 dark:text-green-300">Finished</div>
                )}
                <div>Checked {snapshot.processedSetCount.toLocaleString()} sets of numbers</div>
                <div>Found <b>{snapshot.numberCount.toLocaleString()}</b> numbers</div>
                <NumberPanel numbers={displayNumbers} limit={options.displayLimit}/>
                {snapshot.formulaMap &&
                    <FormulaPanel
                        options={options}
                        status={status}
                        detailLimit={options.displayLimit}
                        formulaMap={snapshot.formulaMap}
                        extraLimit={extraLimit}
                        setExtraLimit={setExtraLimit}
                    />
                }
            </>
        }
    </section>
    )
}

const NumberPanel = ({numbers, limit}: {numbers: Set<number>, limit: number}) => {
    const displayNumbers = []
    let displaySolutionsCount = 0
    for (let i = 0; i <= limit; ++i) {
        const hasSolution = numbers.has(i)
        if (hasSolution) {
            ++displaySolutionsCount
        }
        displayNumbers.push(
            <span key={i} className={hasSolution ? 'text-green-600 dark:text-green-300' : 'text-gray-300 dark:text-gray-600'}>
                {i}
            </span>
        )
    }
    const extraCount = numbers.size - displaySolutionsCount
    return (
        <div className="flex flex-wrap gap-x-2">
            {displayNumbers}
            {extraCount > 0 && <span>and {extraCount} more</span>}
        </div>
    )
}
interface FormulaLine {
    value: number,
    formula: string,
}

interface FormulaPanelProps {
    options: Options,
    status: Status,
    formulaMap: FormulaTextMap,
    detailLimit: number,
    extraLimit: number,
    setExtraLimit: (f: (l: number) => number) => void
}
const FormulaPanel = ({
    options,
    status,
    formulaMap, // all formulas discovered
    detailLimit, // display every number up to this limit, even if no solution
    extraLimit, // display this many formulas after the detailLimit
    setExtraLimit, // display this many formulas after the detailLimit
}: FormulaPanelProps) => {
    // the panel has a "detail" section (containing all numbers) and an "extra"
    // section (containing just numbers with solutions)
    // "lines" are displayed lines, which may or may not include a solution
    const detailLines: FormulaLine[] = []
    let detailSolutionCount = 0
    for (let i = 0; i <= detailLimit; ++i) {
        const formula = formulaMap[i]
        if (formula) {
            ++detailSolutionCount
        }
        detailLines.push({value: i, formula: formula})
    }
    const allSolutions = Object.entries(formulaMap)
    const allSolutionsCount = allSolutions.length
    const extraSolutionsCount = allSolutionsCount - detailSolutionCount
    let extraLines: FormulaLine[] = []
    if (extraLimit > 0) {
        extraLines = allSolutions
            .map(([value, formula]) => ({value: Number(value), formula}))
            .filter(({value, formula}) => value > detailLimit)
            .sort((a, b) => a.value - b.value)
            .slice(0, extraLimit)
    }

    return (
        <div>
            <h2>Results for numbers from 0-{detailLimit}:</h2>
            <FormulaList lines={detailLines}/>
            {extraSolutionsCount > 0 && (
                <>
                    <h2>Solutions for numbers &gt; {detailLimit}:</h2>
                    {extraLimit > 0 && (
                        <>
                            <FormulaList lines={extraLines} formulaMap={formulaMap}/>
                        </>
                    )}
                    {extraSolutionsCount > extraLimit ? (
                        <button onClick={() => setExtraLimit(l => l + 100)}>Show more</button>
                    ) : (
                        <div>Those are all the solutions found so far.</div>
                    )}
                </>
            )}
        </div>
    )
}

const FormulaList = ({lines, formulaMap}: {lines: FormulaLine[], formulaMap?: FormulaTextMap}) => (
    <ul className="formulas">
        {lines.map(
            ({value, formula}) => (
                <li key={value}>
                    {formula && formulaMap && !formulaMap[value - 1] && (
                        <div className="h-0 relative -top-4 text-red-600 dark:text-red-300">...</div>
                    )}
                    <div>
                        <span
                            className={formula ?
                                'text-green-600 dark:text-green-300' :
                                'text-red-600 dark:text-red-300'}>
                            {value}
                        </span>
                        : {formula}
                    </div>
                </li>
            )
        )}
    </ul>
)

function formatTimestamp(timestamp?: number) {
    return timestamp ?
        (timestamp / 1000).toFixed(2) + ' seconds' :
        '--'
}

function getFormulasList(formulaMap: FormulaTextMap, displayLimit: number) {
    const nums = []
    for (let i = 0; i <= displayLimit; ++i) {
        nums.push({value: i, formula: formulaMap[i]})
    }
    for (let i = 0; i <= displayLimit; ++i) {
        nums.push({value: i, formula: formulaMap[i]})
    }
    return nums
}

export default StatusPanel
