import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// CSS is loaded via local tailwind.css in index.html

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Remove static loader
const loader = document.getElementById('app-loading');
if (loader) loader.remove();

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);