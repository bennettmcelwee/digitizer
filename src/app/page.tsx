'use client'

import React, { useEffect, useState } from 'react'
import union from 'ramda/src/union'
import without from 'ramda/src/without'
import Controls from './components/Controls'
import Messager from './components/Messager'
import StatusPanel from './components/Status'
import { Settings, Snapshot, Status } from '../types'

const App = () => {

  const [status, setStatus] = useState<Status>('idle')
  const [messages, setMessages] = useState<string[]>([])
  const [snapshot, setSnapshot] = useState<Snapshot | {}>({})
  const [settings, setSettings] = useState<Settings>()
  const [worker, setWorker] = useState<Worker>()

  const setValue = (name: string, value: boolean | number | string) => {
    const opMatch = name.match(/^symbol(.+)$/)
    if (opMatch) {
      const sym = opMatch[1]
      setSettings(settings => (settings ? {
        ...(settings),
        symbols: (value ? union : without)([sym], settings.symbols ?? [])
      } : settings))
    }
    else {
      setSettings(settings => (settings ? {
        ...settings,
        [name]: value
      } : settings))
    }
  }

  useEffect(() => {
    const theWorker = createWorker()
    setWorker(theWorker)
    theWorker.postMessage({init: {
      options: {
        ...settings
      }
    }})
  }, [])

  const start = () => {
    worker?.postMessage({start: {
      options: {
        ...settings
      }
    }})
  }

  const pause = () => {
    worker?.postMessage({pause: true})
  }

  const resume = () => {
    worker?.postMessage({resume: true})
  }

  const stop = () => {
    worker?.postMessage({stop: true})
  }

  const createWorker = () => {
    const worker = new Worker(new URL('../worker.js', import.meta.url))
    worker.onmessage = e => {
      if (e.data.status) {
        setStatus(e.data.status)
      }
      if (e.data.settings) {
        setSettings(e.data.settings)
      }
      if (e.data.message) {
        setMessages(messages => [...messages, e.data.message])
        console.log('Message: ', e.data.message)
      }
      if (e.data.clearMessages) {
        setMessages([])
      }
      if (e.data.snapshot) {
        setSnapshot(e.data.snapshot)
      }
    }
    return worker
  }

  return (
    <main className="p-4">
      <Controls
        settings={settings}
        setValue={setValue}
        status={status}
        start={start}
        pause={pause}
        resume={resume}
        stop={stop}
      />
      <StatusPanel settings={settings} snapshot={snapshot} />
      <Messager messages={messages} />
    </main>
  )
}

export default App
