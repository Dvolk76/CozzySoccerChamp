import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import WebApp from '@twa-dev/sdk'
import App from './App.tsx'
import './index.css'

// Initialize Telegram WebApp safely
try {
  WebApp.ready()
  WebApp.expand()
  
  // Hide loading indicator after initialization
  setTimeout(() => {
    WebApp.MainButton.hide()
  }, 1000)
} catch (error) {
  console.log('Running outside Telegram WebApp environment')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
