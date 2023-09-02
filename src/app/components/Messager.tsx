import React from 'react';

interface MessagerProps {
    messages: string[],
}

const Messager = ({ messages }: MessagerProps) => (
    <section className="p-4 border rounded-lg">
        <h2>Progress</h2>
        {messages && messages.length ?
            messages.map((message, i) => <div key={i}>{message}</div>)
            :
            <p>Working...</p>
        }
    </section>
)

export default Messager
