import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import PwaPrompts from './pwa'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PwaPrompts />
  </StrictMode>,
)
