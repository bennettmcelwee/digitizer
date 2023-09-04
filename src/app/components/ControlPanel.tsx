import { groupBy, toPairs } from 'ramda'
import React, { useState } from 'react'
import { Options, Status, SymbolDetails } from '../../types'
import { Operator, allOperators } from '@/operators'

function combineDescriptions(operators: Operator[]): SymbolDetails[] {
  const grouped = groupBy<Operator, string>(_ => _.symbol)(operators) as Record<string, Operator[]>
  const pairs = toPairs<Operator[]>(grouped)
  return pairs.map(([symbol, ops]) => ({
    symbol,
    descriptions: ops.map(_ => _.description)
  }))
}

interface ControlPanelProps {
  options: Options,
  status: Status,
  start: () => void,
  pause: () => void,
  resume: () => void,
  stop: () => void,
  setValue: (name: string, value: boolean | number | string) => void,
}

const ControlPanel = ({options, status, start, pause, resume, stop, setValue}: ControlPanelProps) => {

  const [symbolHelp, setSymbolHelp] = useState<SymbolDetails | null>()

  const onChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const target = event.target
    const value =
      target.type === "checkbox" ? target.checked
      : target.type === "number" ? Number(target.value)
      : target.value
    const name = target.name
    setValue(name, value)
  }

  const isRunning = (status === 'running')

  const symbolDetails: SymbolDetails[] = [
    {
      symbol: '( )',
      descriptions: ['Group expressions, e.g. 2×(3+4) = 14'],
    },
    ...combineDescriptions(allOperators)
  ]

  return (
    <section className="p-4 border rounded-lg flex flex-col gap-2">
        <h2 className="font-bold">Digitizer</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="digits" className="inline-block w-30">
            Digits
          </label>
          <input id="digits"
            type="text"
            className="w-24 tracking-widest mr-4"
            name="digitString"
            value={options.digitString ?? ''} onChange={onChange}
            disabled={isRunning}
          />

          <label htmlFor="useall" className="inline-block relative h-6 w-10 cursor-pointer">
            <input className="peer sr-only"
              name="useAllDigits" id="useall" type="checkbox" checked={options.useAllDigits ?? false} onChange={onChange}
              disabled={isRunning}
            />
            <span
              className="absolute inset-0 rounded-full bg-gray-300 transition peer-checked:bg-green-700"
            ></span>
            <span
              className="absolute inset-y-0 start-0 m-1 h-4 w-4 rounded-full bg-white transition-all peer-checked:start-4"
            ></span>
          </label>
          <label htmlFor="useall" className={`cursor-pointer ${options.useAllDigits ? '' : 'text-gray-500'}`}>
            Use all digits
          </label>
        </div>

        <div className="flex gap-2">
          <div className="pt-1.5">
            Symbols
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              {symbolDetails.map(sym => {
                  const name = 'symbol' + sym.symbol
                  const isChecked = options.symbols.includes(sym.symbol)
                  return (
                    <button key={sym.symbol}
                      title={sym.descriptions.join('\n')}
                      className={`inline-block w-10 min-w-fit whitespace-nowrap ${isChecked ? '' : 'dimmed'}`}
                      onClick={() => setValue(name, !isChecked)}
                      onFocus={() => setSymbolHelp(sym)}
                      onBlur={() => setSymbolHelp(null)}
                      disabled={isRunning}
                      >
                      <b>{sym.symbol}</b>
                    </button>
                  )
                })
              }
            </div>
            {symbolHelp && (
              <div className="flex gap-2 items-start mt-1">
                <b className="bg-gray-300 border rounded-lg px-2">{symbolHelp.symbol}</b>
                <ul className="list-none">{symbolHelp.descriptions.map(desc => (
                    <li key={desc}><i>{desc}</i></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <label className="cursor-pointer">
          Pause after{' '}
          <input className="w-20"
            name="maxDurationSeconds" type="number"
            value={options.maxDurationSeconds ?? 0} onChange={onChange}
            disabled={isRunning}
          />
          {' '}seconds
        </label>

        <div className="grid grid-flow-col auto-cols-fr gap-2 w-fit">

          <button onClick={start}
            className={status !== 'running' ? '' : 'dimmed'}
          >Start</button>

          <button onClick={pause}
            className={status === 'running' ? '' : 'dimmed'}
          >Pause</button>

          <button onClick={resume}
            className={status === 'paused' ? '' : 'dimmed'}
          >Resume</button>

          <button onClick={stop}
            className={status !== 'idle' ? '' : 'dimmed'}
            >Stop</button>
        </div>
    </section>
  )
}

export default ControlPanel
