import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Apply the saved theme before React paints to avoid a light-mode flash.
document.documentElement.classList.toggle('dark', localStorage.getItem('hbe_theme') === 'dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
