import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

(window as any).__DD_BOOTED__ = true;

const rootEl = document.getElementById('root');
if (rootEl && !(window as any).__DD_MOUNTED__) {
  (window as any).__DD_MOUNTED__ = true;
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
