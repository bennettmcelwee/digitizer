import { FormulaTextMap, Options, Snapshot, Status } from '@/types';
import React, { useEffect, useState } from 'react';

interface StatusPanelProps {
    options: Options,
    status: Status,
    snapshot?: Snapshot,
}
const StatusPanel = ({ options, status, snapshot }: StatusPanelProps) => {
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
                    <div>Paused</div>
                )}
                {status === 'idle' && (
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
                                ({value, formula}) => (
                                    <li key={value}>
                                        <span
                                            className={formula ?
                                                'text-green-600 dark:text-green-300' :
                                                'text-red-600 dark:text-red-300'}>
                                            {value}
                                        </span>
                                        : {formula}
                                    </li>))
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
