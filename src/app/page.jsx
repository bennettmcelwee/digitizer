'use client'

import React, { Component, useEffect, useState } from 'react'
import append from 'ramda/src/append'
import difference from 'ramda/src/difference'
import union from 'ramda/src/union'
import without from 'ramda/src/without'
import Controls from './components/Controls'
import Messager from './components/Messager'
import Status from './components/Status'

const App = (props) => {

  const [messages, setMessages] = useState([])
  const [snapshot, setSnapshot] = useState({})
  const [settings, setSettings] = useState({})
  const [worker, setWorker] = useState()

  const setValue = (name, value) => {
    const opMatch = name.match(/^symbol(.+)$/)
    if (opMatch) {
      const sym = opMatch[1]
      setSettings(settings => ({
        ...settings,
        symbols: (value ? union : without)([sym], settings.symbols)
        })
      )
    }
    else {
      setSettings(settings => ({
        ...settings,
        [name]: value
        })
      )
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
    worker.postMessage({start: {
      options: {
        ...settings
      }
    }})
  }

  const pause = () => {
    worker.postMessage({pause: true})
  }

  const resume = () => {
    worker.postMessage({resume: true})
  }

  const createWorker = () => {
    const worker = new Worker(new URL('worker.js', import.meta.url))
    worker.onmessage = e => {
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
        // Update messages
        if (e.data.snapshot.wholes && e.data.snapshot.wholes.length) {
          const newWholes = difference(e.data.snapshot.wholes ?? [], snapshot.wholes ?? [])
          if (newWholes.length) {
            const newMessages = messages ?? []
            newMessages.push("New:" + newWholes)
            setMessages(newMessages)
          }
        }
        setSnapshot(e.data.snapshot)
      }
    }
    return worker
  }

  return (
    <main>
      <Controls
        settings={settings}
        setValue={setValue}
        start={start}
        pause={pause}
        resume={resume}
      />
      <Status settings={settings} snapshot={snapshot} />
      <Messager messages={messages} />
    </main>
  )
}

export default App
