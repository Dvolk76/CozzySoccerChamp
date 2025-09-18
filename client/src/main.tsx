import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import WebApp from '@twa-dev/sdk'
import App from './App.tsx'
import './index.css'

// Initialize Telegram WebApp safely - moved to App.tsx to avoid double initialization
console.log('Loading in environment:', {
  isTelegram: !!window.Telegram?.WebApp,
  userAgent: navigator.userAgent
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
