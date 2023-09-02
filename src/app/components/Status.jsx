import React from 'react';

const Status = ({ settings, snapshot }) => {
    const countsString = snapshot.setCounts?.map(_ => _.toLocaleString()).join(' ')
    return (
    <section className="p-4 border rounded-lg">
        <h2>Num, num</h2>
        {settings &&
            <p>Making numbers with digits{' '}
                {settings.digitString}
                {' '}and symbols {settings.symbols?.join(' ')}{' '}
                for {settings.maxDurationSeconds} seconds
            </p>
        }
        <h2>Status</h2>
        <div>Elapsed time: {snapshot.time} seconds</div>
        <div>Current task: <strong>{snapshot.label}</strong></div>
        <div>Checked {countsString ?? 'no'} sets of numbers</div>
        <div>Currently {snapshot.setCurrent && snapshot.setCount ? `checking ${snapshot.setCurrent.toLocaleString() ?? '?'} of ${snapshot.setCount.toLocaleString()} sets of numbers` : 'not checking'}</div>
        <div>Found {snapshot.numberCount ? <b>{snapshot.numberCount.toLocaleString()}</b> : 'no'} numbers</div>
        {snapshot.formulaMap &&
            <div>
                <h2>Results</h2>
                <ul className="results">
                    {getFormulasList(snapshot.formulaMap, settings.displayLimit).map(
                        ({value, formula}) => (<li key={value}>{value}: {formula}</li>))
                    }
                </ul>
            </div>
        }
    </section>
    )
}

function getFormulasList(formulaMap, displayLimit) {
    const nums = []
    for (let i = 0; i <= displayLimit; ++i) {
        nums.push({value: i, formula: formulaMap[i]})
    }
    return nums
}

export default Status
