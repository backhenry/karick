import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';

// PWA: registra o service worker (só em produção — em dev atrapalha o HMR).
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
