import React from 'react'

const Controls = ({settings = {}, start, pause, resume, setValue}) => {

  const onChange = (event) => {
    const target = event.target
    const value =
      target.type === "checkbox" ? target.checked
      : target.type === "number" ? Number(target.value)
      : target.value
    const name = target.name
    setValue(name, value)
  }

  return (
    <div className="controls">
        <h2>Settings</h2>
        <div className="group">
          Digits:
          <input name="digitString" type="string"
            value={settings.digitString ?? 0} onChange={onChange}
          />
        </div>
        <div className="group">
          Use all digits:
          <input name="useAllDigits" type="checkbox" checked={settings.useAllDigits ?? false} onChange={onChange}/>
        </div>
        <div className="group">
          Seconds:
          <input name="maxDurationSeconds" type="number"
            value={settings.maxDurationSeconds ?? 0} onChange={onChange}
          />
        </div>
        <div className="symbols group btn-group-toggle" data-toggle="buttons">
          {settings.allOperators?.map(op => {
              const name = 'symbol' + op.symbol
              const isChecked = settings.symbols && settings.symbols.includes(op.symbol)
              return (
                <button key={op.symbol}
                  title={op.description}
                  class={`inline-block px-4 py-2 text-sm font-medium text-gray-200 ${isChecked ? 'bg-green-700' : 'bg-gray-900'} hover:bg-gray-500 focus:relative`}
                  onClick={() => setValue(name, !isChecked)}
                >
                  {op.symbol}
                </button>
              )
            })
          }
        </div>
        <div className="group">
          <button onClick={start} className="btn btn-success">Start</button>
          <button onClick={pause} className="btn btn-outline-primary">Pause</button>
          <button onClick={resume} className="btn btn-outline-primary">Resume</button>
        </div>
    </div>
  )
}

export default Controls
