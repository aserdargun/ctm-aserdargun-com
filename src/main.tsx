/**
 * Cell to Mind — uygulama giriş noktası.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './ui/styles.css';
import { useStore } from './engine/store.ts';

const container = document.getElementById('root');
if (!container) throw new Error('#root bulunamadı');

document.documentElement.lang = useStore.getState().language;

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Yükleme perdesini yalnızca React kökü bağlandıktan sonra kaldır.
queueMicrotask(() => {
  const boot = document.getElementById('boot');
  if (boot) boot.remove();
});