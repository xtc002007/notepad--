import React, { Suspense } from 'react';

// Lazy load the MainApp which contains all heavy dependencies (Storage, Tauri, Lucide)
const MainApp = React.lazy(() => import('./MainApp'));

// Simple SVG Spinner for instant feedback
const LoadingSpinner = () => (
  <svg className="animate-spin text-gray-400" width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.1" />
    <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const App: React.FC = () => {
  return (
    <div className="flex h-screen w-full bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 items-center justify-center">
      <Suspense fallback={<LoadingSpinner />}>
        <MainApp />
      </Suspense>
    </div>
  );
};

export default App;
