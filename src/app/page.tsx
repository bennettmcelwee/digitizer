// Copyright 2023 Bennett McElwee. All rights reserved.
'use client'

import React, { useEffect, useState } from 'react'
import union from 'ramda/src/union'
import without from 'ramda/src/without'
import ControlPanel from './components/ControlPanel'
import MessagePanel from './components/MessagePanel'
import StatusPanel from './components/StatusPanel'
import { Options, Snapshot, Status } from '../types'
import { WorkerMessage } from '@/worker'

const DEFAULT_OPTIONS: Options = {
  digitString: (new Date().getFullYear()).toString(),
  useAllDigits: true,
  preserveOrder: false,
  symbols: ['( )', '+', '-', '×', '÷', '&', '!', '^'],
  // Display
  displayLimit: 100,
  quiet: false,
  heartbeatSeconds: 0.5,
  // Internals
  valueLimit: 10000,
  // Timing
  yieldSeconds: 1,
  maxDurationSeconds: 5,
  minHeartbeats: 1
}

export interface AppMessage {
  status?: Status,
  message?: string,
  clearMessages?: true,
  snapshot?: Snapshot,
}

const App = () => {

  const [status, setStatus] = useState<Status>('idle')
  const [messages, setMessages] = useState<string[]>([])
  const [snapshot, setSnapshot] = useState<Snapshot>()
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS)
  const [worker, setWorker] = useState<Worker>()

  function postWorkerMessage(message: WorkerMessage) {
    worker?.postMessage(message)
  }

  const setValue = (name: string, value: boolean | number | string) => {
    const opMatch = name.match(/^symbol(.+)$/)
    if (opMatch) {
      const sym = opMatch[1]
      setOptions(options => ({
        ...options,
        symbols: (value ? union : without)([sym], options.symbols ?? [])
      }))
    }
    else {
      setOptions(options => ({
        ...options,
        [name]: value
      }))
      // special case: turning off useAllDigits will also turn off preserveOrder
      if (name === 'useAllDigits' && !value) {
        setOptions(options => ({
          ...options,
          preserveOrder: false
        }))
      }
    }
  }

  useEffect(() => {
    const theWorker = createWorker()
    setWorker(theWorker)
  }, [])

  const start = () => {
    postWorkerMessage({command: 'start', options})
  }

  const pause = () => {
    postWorkerMessage({command: 'pause'})
  }

  const resume = () => {
    postWorkerMessage({command: 'resume'})
  }

  const stop = () => {
    postWorkerMessage({command: 'stop'})
  }

  const createWorker = () => {
    const worker = new Worker(new URL('../worker.ts', import.meta.url))
    worker.onmessage = (e: MessageEvent<AppMessage>) => {
      if (e.data.status) {
        setStatus(e.data.status)
      }
      if (e.data.message) {
        setMessages(messages => [...messages, e.data.message!])
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
    <main className="p-4 text-gray-900 dark:text-gray-200">
      <ControlPanel
        options={options}
        setValue={setValue}
        status={status}
        start={start}
        pause={pause}
        resume={resume}
        stop={stop}
      />
      <StatusPanel options={options} status={status} snapshot={snapshot} />
      {/* <MessagePanel messages={messages} /> */}
    </main>
  )
}

export default App
