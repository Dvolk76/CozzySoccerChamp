import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import WebApp from '@twa-dev/sdk'
import App from './App.tsx'
import './index.css'

// Initialize Telegram WebApp
WebApp.ready()

// Expand WebApp to full height
WebApp.expand()

// Show loading indicator initially
WebApp.MainButton.setText('Loading...')
WebApp.MainButton.show()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
