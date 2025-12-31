import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/globals.css'
import App from './App'

// Get the root element - support both 'root' and 'app' IDs for compatibility
const container = document.getElementById('root') || document.getElementById('app')

if (!container) {
    throw new Error('Root container not found. Please add a div with id="root" or id="app" to index.html')
}

createRoot(container).render(
    <StrictMode>
        <App />
    </StrictMode>
)
