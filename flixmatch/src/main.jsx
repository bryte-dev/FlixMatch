import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import { BrowserRouter } from 'react-router-dom'
import axios from 'axios'
import { installImageFallback } from './lib/imageFallback'
import { initAnalytics, installAxiosAnalytics, installErrorTracking } from './lib/analytics'

installImageFallback()
installAxiosAnalytics(axios)
installErrorTracking()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

// Analytics chargés après le premier rendu (sans effet si PostHog n'est pas configuré)
window.addEventListener('load', () => setTimeout(initAnalytics, 0))

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.error('Service worker :', err))
  })
}
