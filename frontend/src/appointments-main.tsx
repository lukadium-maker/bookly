import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import MyAppointments from './MyAppointments'

const tg = (window as any).Telegram?.WebApp
if (tg) { tg.ready(); tg.expand() }
const telegramId = String(tg?.initDataUnsafe?.user?.id || '')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MyAppointments telegramId={telegramId} />
  </StrictMode>
)
