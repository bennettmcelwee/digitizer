// Copyright 2023 Bennett McElwee. All rights reserved.
import { groupBy, toPairs } from 'ramda'
import React, { useRef, useState } from 'react'
import { Options, Status, SymbolDetails } from '../../types'
import { Operator, allOperators } from '@/operators'
import ToggleSwitch from './ToggleSwitch'

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
  const symbolHelpRef = useRef<HTMLDivElement>(null);

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const target = event.target
    const value =
      target.type === "checkbox" ? target.checked
      : target.type === "number" ? Number(target.value)
      : target.value
    const name = target.name
    setValue(name, value)
  }

  const toggleAdvanced: React.MouseEventHandler = (event) => {
    setValue('advanced', !options.advanced)
    event.preventDefault()
  }

  const handleFocus = (symbol: SymbolDetails) => {
    setSymbolHelp(symbol)
    const element = symbolHelpRef.current
    if (element) {
      setTimeout(() => {
        element.style.height = 'auto'
      }, 0)
    }
  }

  const handleBlur = () => {
    setSymbolHelp(null)
    const element = symbolHelpRef.current
    if (element) {
      element.style.height = element.clientHeight + 'px'
      setTimeout(() => {
        element.style.height = '0'
      }, 0)
    }
  }

  const isRunning = (status !== 'idle' && status !== 'done')

  const symbolDetails: SymbolDetails[] = [
    {
      symbol: '( )',
      descriptions: ['Group expressions, e.g. 2×(3+4) = 14'],
    },
    ...combineDescriptions(allOperators)
  ]

  const disabled = isRunning
  return (
    <section className="p-4 border rounded-lg flex flex-col gap-4">
        <h2 className="font-bold">Digitizer <i className="font-normal">by Bennett</i></h2>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="digits" className="inline-block w-30">
              Digits
            </label>
            <input id="digits"
              type="text"
              className={`w-24 tracking-widest ${disabled ? 'opacity-50' : ''}`}
              name="digitString"
              value={options.digitString ?? ''} onChange={handleChange}
              disabled={disabled}
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <ToggleSwitch id="useall" name="useAllDigits"
              label="Use all digits" value={options.useAllDigits}
              disabled={disabled} onChange={handleChange}
            />
            <ToggleSwitch id="order" name="preserveOrder"
              label="Keep digits in order" value={options.preserveOrder}
              disabled={disabled || !options.useAllDigits} onChange={handleChange}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <div className="pt-2">
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
                      className={`inline-block w-10 min-w-fit whitespace-nowrap ${isChecked ? '' : 'dimmed'} ${disabled ? 'opacity-50' : ''}`}
                      onClick={() => setValue(name, !isChecked)}
                      onFocus={() => handleFocus(sym)}
                      onBlur={() => handleBlur()}
                      disabled={disabled}
                    >
                      <b>{sym.symbol}</b>
                    </button>
                  )
                })
              }
            </div>
            <div className="transition-all ease-in duration-500" ref={symbolHelpRef}>
              {symbolHelp && (
                <div className="flex gap-2 items-start pt-2">
                  <b className="bg-gray-300 dark:bg-gray-600 rounded-lg px-2 whitespace-nowrap">{symbolHelp.symbol}</b>
                  <ul className="list-none">{symbolHelp.descriptions.map(desc => (
                      <li key={desc}><i>{desc}</i></li>
                    ))}
                  </ul>
                  </div>
              )}
            </div>
          </div>
        </div>

        <label className="cursor-pointer">
          Pause every{' '}
          <input className={`w-20 ${disabled ? 'opacity-50' : ''}`}
            name="maxDurationSeconds" type="number"
            value={options.maxDurationSeconds ?? 0} onChange={handleChange}
            disabled={disabled}
          />
          {' '}seconds
        </label>

        {options.advanced && (
          <div>
            Strategy: {options.strategy}
          </div>
        )}

        <div className="grid grid-flow-col auto-cols-fr gap-2 w-fit">

          <button onClick={start}
            className={status === 'idle' || status === 'done' ? '' : 'dimmed'}
          >Start</button>

          <button onClick={pause}
            className={status === 'running' ? '' : 'dimmed'}
          >Pause</button>

          <button onClick={resume}
            className={status === 'paused' ? '' : 'dimmed'}
          >Resume</button>

          <button onClick={stop}
            className={status === 'running' || status === 'paused' ? '' : 'dimmed'}
            >Stop</button>

          <a href="#" onClick={toggleAdvanced}>Advanced options</a>
        </div>
    </section>
  )
}

export default ControlPanel
