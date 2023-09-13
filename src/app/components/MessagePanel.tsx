// Copyright 2023 Bennett McElwee. All rights reserved.
import React from 'react';

interface MessagePanelProps {
    messages: string[],
}

const MessagePanel = ({ messages }: MessagePanelProps) => (
    <section className="p-4 border rounded-lg">
        <h2>Progress</h2>
        {messages && messages.length ?
            messages.map((message, i) => <div key={i}>{message}</div>)
            :
            null
        }
    </section>
)

export default MessagePanel
