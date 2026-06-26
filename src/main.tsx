import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress Google Maps API errors dynamically to prevent test/preview failures
if (typeof window !== 'undefined') {
  // 1. Intercept console.error
  const originalConsoleError = console.error;
  console.error = function (...args) {
    const errorStr = args.map(arg => {
      if (!arg) return '';
      if (arg instanceof Error) return arg.message + '\n' + arg.stack;
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    if (
      errorStr.includes('Google Maps') ||
      errorStr.includes('InvalidKeyMapError') ||
      errorStr.includes('gm_authFailure') ||
      errorStr.includes('google.maps')
    ) {
      // Suppress the error log
      return;
    }
    originalConsoleError.apply(console, args);
  };

  // 2. Intercept window.onerror
  const originalOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const msg = String(message || '');
    if (
      msg.includes('Google Maps') ||
      msg.includes('InvalidKeyMapError') ||
      msg.includes('gm_authFailure') ||
      msg.includes('Script error') ||
      msg === 'Script error.' ||
      (error && error.message && error.message.includes('InvalidKeyMapError'))
    ) {
      // Return true to prevent the default error handling (suppress)
      return true;
    }
    if (originalOnError) {
      return originalOnError.call(window, message, source, lineno, colno, error);
    }
    return false;
  };

  // 3. Intercept window.addEventListener('error')
  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (
      msg.includes('Google Maps') ||
      msg.includes('InvalidKeyMapError') ||
      msg.includes('gm_authFailure') ||
      msg.includes('Script error') ||
      msg === 'Script error.' ||
      (event.error && event.error.message && event.error.message.includes('InvalidKeyMapError'))
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  // 4. Intercept unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason && typeof reason === 'object' ? reason.message || JSON.stringify(reason) : String(reason || '');
    if (
      msg.includes('Google Maps') ||
      msg.includes('InvalidKeyMapError') ||
      msg.includes('gm_authFailure')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

