import React, { Suspense } from 'react';

// Lazy load the MainApp which contains all heavy dependencies (Storage, Tauri, Lucide)
const MainApp = React.lazy(() => import('./MainApp'));

interface AppProps {
  onReady?: () => void;
}

const App: React.FC<AppProps> = ({ onReady }) => {
  return (
    <div className="flex h-screen w-full bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100">
      <Suspense fallback={null}>
        <MainApp onReady={onReady} />
      </Suspense>
    </div>
  );
};

export default App;
