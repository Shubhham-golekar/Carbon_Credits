import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { Web3Provider } from './context/Web3Context.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Web3Provider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#16161d',
              color: '#f1f1f3',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '12px',
              fontSize: '0.875rem',
              fontFamily: "'Inter', sans-serif",
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#0c0c0f' },
              duration: 4000,
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#fff' },
              duration: 5000,
            },
            loading: {
              iconTheme: { primary: '#6366f1', secondary: '#0c0c0f' },
            },
          }}
        />
      </Web3Provider>
    </BrowserRouter>
  </React.StrictMode>,
)
