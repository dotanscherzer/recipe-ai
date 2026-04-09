import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './config/queryClient';
import App from './App';
import { setLanguage } from './i18n';
import './index.css';

try {
  const raw = localStorage.getItem('recipe-ai-app');
  if (raw) {
    const parsed = JSON.parse(raw) as { state?: { locale?: string } };
    const loc = parsed.state?.locale;
    if (loc === 'he' || loc === 'en') setLanguage(loc);
  }
} catch {
  /* ignore corrupt storage */
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
