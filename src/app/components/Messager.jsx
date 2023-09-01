import React from 'react';

export default ({ messages }) => (
    <div className="messager">
        <h2>Progress</h2>
        {messages && messages.length ?
            messages.map((message, i) => <div key={i}>{message}</div>)
            :
            <p>Working...</p>
        }
    </div>
);
