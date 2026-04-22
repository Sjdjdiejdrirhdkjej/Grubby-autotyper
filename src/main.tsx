import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Humanizer from './pages/Humanizer'
import Autotyper from './pages/Autotyper'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Humanizer />} />
        <Route path="/autotyper" element={<Autotyper />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
