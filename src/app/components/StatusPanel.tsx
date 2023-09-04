import { FormulaTextMap, Options, Snapshot } from '@/types';
import React, { useEffect, useState } from 'react';

interface StatusPanelProps {
    runId?: string,
    options: Options,
    snapshot?: Snapshot,
}
const StatusPanel = ({ runId, options, snapshot }: StatusPanelProps) => {
    const [displayNumbers, setDisplayNumbers] = useState<Set<number>>(new Set())
    const [displayNumbersRunId, setDisplayNumbersRunId] = useState<string>()
    useEffect(() => {
        if (snapshot?.numbers) {
            if (runId !== displayNumbersRunId) {
                setDisplayNumbers(snapshot.numbers)
                setDisplayNumbersRunId(runId)
            } else {
                for (const n of snapshot.numbers.values()) {
                    displayNumbers.add(n)
                }
            }
        }
    }, [displayNumbers, displayNumbersRunId, runId, snapshot?.numbers])

    return (
    <section className="p-4 border rounded-lg">
        {options &&
            <p>Making numbers with digits{' '}
                {options.digitString.split('').join(' ')}
                {' '}and symbols {options.symbols?.join(' ')}{' '}
                for {options.maxDurationSeconds} seconds
            </p>
        }

        {snapshot &&
            <>
                <div>Processing time: {formatTimestamp(snapshot.time)}</div>
                {snapshot.currentRound ? (
                    <div>Processing round {snapshot.currentRound}{' '}
                        ({Math.round((snapshot.currentSetProcessed ?? 0) / snapshot.currentSetCount * 100)}%){' '}
                        ({(snapshot.currentSetProcessed ?? 0).toLocaleString()} / {snapshot.currentSetCount.toLocaleString()} candidates)
                    </div>
                ) : (
                    <div>Idle</div>
                )}
                <div>Checked {snapshot.processedSetCount.toLocaleString()} sets of numbers</div>
                <div>Found <b>{snapshot.numberCount.toLocaleString()}</b> numbers</div>
                <NumberPanel numbers={displayNumbers} limit={options.displayLimit}/>
                {snapshot.formulaMap &&
                    <div>
                        <h2>Results</h2>
                        <ul className="results">
                            {getFormulasList(snapshot.formulaMap, options.displayLimit).map(
                                ({value, formula}) => (<li key={value}>{value}: {formula}</li>))
                            }
                        </ul>
                    </div>
                }
            </>
        }
    </section>
    )
}

const NumberPanel = ({numbers, limit}: {numbers: Set<number>, limit: number}) => {
    const displayNumbers = []
    for (let i = 0; i <= limit; ++i) {
        displayNumbers.push(
            <span key={i} className={numbers.has(i) ? 'text-green-600 dark:text-green-300' : 'text-gray-300 dark:text-gray-600'}>
                {i}
            </span>
        )
    }
    return (
        <div className="flex flex-wrap gap-x-2">
            {displayNumbers}
        </div>
    )
}

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
    return nums
}

export default StatusPanel
