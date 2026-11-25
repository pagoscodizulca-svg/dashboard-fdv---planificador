import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AppUpdateBanner } from './components/AppUpdateBanner';
import { startFdvVersionGuard } from './lib/appVersionGuard';
import './index.css';

startFdvVersionGuard();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <AppUpdateBanner />
  </StrictMode>,
);
