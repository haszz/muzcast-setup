import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installMock } from './mock'
import App from './App'

// A missing native bridge must never turn a real desktop installation into a simulated success.
const desktop = navigator.userAgent.includes('Electron')
if (!desktop) installMock()

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    {window.cytv ? <App previewStep={!desktop && new URLSearchParams(location.search).get("preview") === "clean" ? 2 : 0} /> : <main style={{ padding: 48 }}>
      <h1>Muzcast n’a pas pu démarrer</h1>
      <p>Fermez puis relancez l’application. Aucune modification n’a été faite sur votre TV.</p>
    </main>}
  </StrictMode>
)
