import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// CSS is loaded via local tailwind.css in index.html

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Show the Tauri window and fade out the splash screen when app is ready
const dismissSplash = async () => {
  // Show the Tauri window (it starts hidden to prevent white flash)
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('show_main_window');
  } catch (e) {
    // Fallback: if not running in Tauri (e.g. dev browser), ignore
  }

  // Fade out the HTML splash screen
  const loader = document.getElementById('app-loading');
  if (loader) {
    loader.classList.add('fade-out');
    setTimeout(() => loader.remove(), 400);
  }
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App onReady={dismissSplash} />
  </React.StrictMode>
);
