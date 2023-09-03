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
            <p>Working...</p>
        }
    </section>
)

export default MessagePanel
