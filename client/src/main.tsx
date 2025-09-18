import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import WebApp from '@twa-dev/sdk'
import App from './App.tsx'
import './index.css'

// Telegram WebApp will be initialized in App.tsx

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
