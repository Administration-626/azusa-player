import React from "react";
import { createRoot } from 'react-dom/client';
import { App } from "./App";
import "../css/popup.css";

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => event.preventDefault());
  window.addEventListener('unhandledrejection', (event) => event.preventDefault());
}

try {
    console.log(
        `%c azusa-player %c v${__APP_VERSION__} %c Commit: ${__COMMIT_HASH__} %c Build: ${__BUILD_TIME__} `,
        'background: #fb7299; color: #fff; border-radius: 3px 0 0 3px; padding: 2px 4px;',
        'background: #333; color: #fff; padding: 2px 4px;',
        'background: #555; color: #fff; padding: 2px 4px;',
        'background: #777; color: #fff; border-radius: 0 3px 3px 0; padding: 2px 4px;'
    );
} catch (e) {
    // Ignore in environments where globals are not injected
}

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}
