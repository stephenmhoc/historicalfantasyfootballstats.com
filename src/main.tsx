import './instrument'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '@sentry/react'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallback={<p className="p-4">Something went wrong. Please reload the page.</p>}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
