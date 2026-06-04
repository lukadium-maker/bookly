import MyAppointments from './MyAppointments'
import AdminPanel from './AdminPanel'
import { useEffect, useState } from 'react'
import axios from 'axios'
import jalaali from 'jalaali-js'
import OwnerDashboard from './OwnerDashboard'

const API = 'https://bookly.kindtoy.ir/api'

interface Service {
  id: string
  name: string
  duration: number
  price: number
  description?: string
}

interface Business {
  id: string
  name: string
  description?: string
  category?: string
  avatarUrl?: string
  services: Service[]
}

interface Slot {
  start: string
  end: string
  available: boolean
  status: string
}

type Screen = 'loading' | 'services' | 'calendar' | 'slots' | 'confirm' | 'success'

const PERSIAN_MONTHS = [
  'فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور',
  'مهر','آبان','آذر','دی','بهمن','اسفند'
]
const PERSIAN_DAYS = ['ی','د','س','چ','پ','ج','ش']

const SERVICE_ICONS: Record<string, string> = {
  'nail': '💅', 'manicure': '💅', 'pedicure': '🦶',
  'hair': '✂️', 'tattoo': '🎨', 'lash': '👁️',
  'massage': '💆', 'barber': '💈', 'default': '✨'
}

const getServiceIcon = (name: string) => {
  const lower = name.toLowerCase()
  for (const [key, icon] of Object.entries(SERVICE_ICONS)) {
    if (lower.includes(key)) return icon
  }
  return SERVICE_ICONS.default
}

const toPersianNum = (n: number) =>
  n.toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d)])

const formatTime = (iso: string) => {
  const d = new Date(iso)
  // Convert UTC to Tehran (UTC+3:30 = +210 minutes)
  const tehranMs = d.getTime() + 210 * 60 * 1000
  const tehran = new Date(tehranMs)
  const h = tehran.getUTCHours().toString().padStart(2, '0')
  const m = tehran.getUTCMinutes().toString().padStart(2, '0')
  return toPersianNum(parseInt(h)) + ':' + (m === '00' ? '۰۰' : toPersianNum(parseInt(m)))
}

const toJalali = (date: Date) =>
  jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate())

const toGregorian = (jy: number, jm: number, jd: number) =>
  jalaali.toGregorian(jy, jm, jd)

const formatJalaliDate = (date: Date) => {
  const { jy, jm, jd } = toJalali(date)
  const dayName = PERSIAN_DAYS[date.getDay()]
  return dayName + ' ' + toPersianNum(jd) + ' ' + PERSIAN_MONTHS[jm - 1] + ' ' + toPersianNum(jy)
}

const formatPrice = (price: number) => {
  if (price === 0) return 'رایگان'
  return toPersianNum(price) + ' تومان'
}

export default function App() {
  const params = new URLSearchParams(window.location.search)
  const mode = params.get('mode')
  const isAdmin = params.get('admin') === '1'
  const businessSlug = params.get('business') || 'test-salon'

  const tg = (window as any).Telegram?.WebApp
  const telegramId = String(tg?.initDataUnsafe?.user?.id || '24247682')

  // Admin panel
  if (isAdmin) return <AdminPanel telegramId={telegramId} />

  // If owner mode, show dashboard
  if (mode === 'owner') {
    return <OwnerDashboard telegramId={telegramId} businessSlug={''} />
  }

  if (mode === 'myappointments') return <MyAppointments telegramId={telegramId} />

  const [screen, setScreen] = useState<Screen>('loading')
  const [business, setBusiness] = useState<Business | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const today = new Date()
  const todayJalali = toJalali(today)
  const [jYear, setJYear] = useState(todayJalali.jy)
  const [jMonth, setJMonth] = useState(todayJalali.jm)

  useEffect(() => {
    if (tg) { tg.ready(); tg.expand() }
    axios.get(API + '/businesses/' + businessSlug)
      .then(res => { setBusiness(res.data); setScreen('services') })
      .catch(() => { setError('کسب‌وکار یافت نشد'); setScreen('services') })
  }, [])

  const loadSlots = async (service: Service, date: Date) => {
    setLoading(true)
    setSlots([])
    try {
      // Use local date to avoid UTC timezone shift
      const dateStr = date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0')
      const res = await axios.get(API + '/businesses/' + businessSlug + '/slots', {
        params: { serviceId: service.id, date: dateStr }
      })
      setSlots(res.data.slots)
    } catch {
      setError('خطا در دریافت زمان‌های آزاد')
    }
    setLoading(false)
  }

  const handleServiceSelect = (service: Service) => { setSelectedService(service); setScreen('calendar') }
  const handleDateSelect = async (date: Date) => {
    setSelectedDate(date); setSelectedSlot(null)
    await loadSlots(selectedService!, date); setScreen('slots')
  }
  const handleSlotSelect = (slot: Slot) => { setSelectedSlot(slot); setScreen('confirm') }

  const handleConfirm = async () => {
    if (!selectedSlot || !selectedService || !business) return
    setLoading(true); setError('')
    try {
      await axios.post(API + '/appointments', {
        businessId: business.id, serviceId: selectedService.id,
        clientTelegramId: telegramId, startTime: selectedSlot.start, clientNote: note
      })
      setScreen('success')
      tg?.HapticFeedback?.notificationOccurred('success')
    } catch (err: any) {
      setError(err.response?.data?.error || 'خطا در ثبت نوبت')
    }
    setLoading(false)
  }

  const prevMonth = () => { if (jMonth === 1) { setJYear(jYear-1); setJMonth(12) } else setJMonth(jMonth-1) }
  const nextMonth = () => { if (jMonth === 12) { setJYear(jYear+1); setJMonth(1) } else setJMonth(jMonth+1) }

  const isDateAvailable = (jy: number, jm: number, jd: number) => {
    const { gy, gm, gd } = toGregorian(jy, jm, jd)
    const date = new Date(gy, gm-1, gd)
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)
    return date >= todayStart
  }

  if (screen === 'loading') return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',gap:'16px'}}>
      <div style={{marginBottom:'8px'}}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></div>
      <div style={{fontSize:'18px',fontWeight:'700',color:'#C9A84C'}}>بوکلی</div>
      <div style={{fontSize:'14px',color:'rgba(255,255,255,0.4)'}}>در حال بارگذاری...</div>
      <div style={{width:'40px',height:'3px',background:'linear-gradient(90deg,#6333ff,#C9A84C)',borderRadius:'2px',animation:'pulse 1.5s infinite'}}></div>
    </div>
  )

  if (screen === 'services') return (
    <div className="screen" dir="rtl">
      <div className="header">
        {business?.avatarUrl ? (
          <img src={'https://bookly.kindtoy.ir' + business.avatarUrl + '?t=' + Date.now()} className="business-avatar-img" alt="avatar" />
        ) : (
          <div className="business-avatar">✨</div>
        )}
        <h1>{business?.name || 'رزرو نوبت'}</h1>
        {business?.description && <p>{business.description}</p>}
      </div>
      {error && <div className="error-msg">{error}</div>}
      <div className="section-title">انتخاب سرویس</div>
      {business?.services.map(service => (
        <div key={service.id} className="service-card" onClick={() => handleServiceSelect(service)}>
          <div className="service-card-left">
            <div className="service-icon">{getServiceIcon(service.name)}</div>
            <div>
              <div className="service-name">{service.name}</div>
              <div className="service-meta">{toPersianNum(service.duration)} دقیقه</div>
            </div>
          </div>
          <div className="service-price">{formatPrice(service.price)}</div>
        </div>
      ))}
      <div className="bottom-padding" />
    </div>
  )

  if (screen === 'calendar') {
    const daysInMonth = jalaali.jalaaliMonthLength(jYear, jMonth)
    const { gy, gm, gd } = toGregorian(jYear, jMonth, 1)
    const firstDay = (new Date(gy, gm-1, gd).getDay() + 1) % 7
    return (
      <div className="screen" dir="rtl">
        <button className="back-btn" onClick={() => setScreen('services')}>← بازگشت</button>
        <div className="header">
          <div className="business-avatar">{getServiceIcon(selectedService?.name || '')}</div>
          <h1>{selectedService?.name}</h1>
          <p>{toPersianNum(selectedService?.duration || 0)} دقیقه · {formatPrice(selectedService?.price || 0)}</p>
        </div>
        <div className="section-title">انتخاب تاریخ</div>
        <div className="calendar">
          <div className="calendar-header">
            <button className="calendar-nav" onClick={nextMonth}>›</button>
            <span>{PERSIAN_MONTHS[jMonth-1]} {toPersianNum(jYear)}</span>
            <button className="calendar-nav" onClick={prevMonth}>‹</button>
          </div>
          <div className="calendar-grid">
            {['ش','ی','د','س','چ','پ','ج'].map(d => <div key={d} className="calendar-day-name">{d}</div>)}
            {Array.from({length: firstDay}).map((_,i) => <div key={'e'+i} />)}
            {Array.from({length: daysInMonth}).map((_,i) => {
              const jd = i+1
              const available = isDateAvailable(jYear, jMonth, jd)
              const {gy,gm,gd} = toGregorian(jYear, jMonth, jd)
              const date = new Date(gy,gm-1,gd)
              const isSelected = selectedDate?.toDateString() === date.toDateString()
              const isToday = today.toDateString() === date.toDateString()
              return (
                <button key={jd}
                  className={'calendar-day'+(isSelected?' selected':'')+(isToday?' today':'')}
                  disabled={!available} onClick={() => handleDateSelect(date)}>
                  {toPersianNum(jd)}
                </button>
              )
            })}
          </div>
        </div>
        <div className="bottom-padding" />
      </div>
    )
  }

  if (screen === 'slots') return (
    <div className="screen" dir="rtl">
      <button className="back-btn" onClick={() => setScreen('calendar')}>← بازگشت</button>
      <div className="header">
        <div className="business-avatar">🕐</div>
        <h1>انتخاب ساعت</h1>
        <p>{selectedDate && formatJalaliDate(selectedDate)}</p>
      </div>
      {loading && <div className="loading">در حال بارگذاری...</div>}
      {!loading && slots.length === 0 && <div className="error-msg">زمان آزادی برای این روز وجود ندارد.</div>}
      {!loading && slots.length > 0 && slots.filter(s => s.available).length === 0 && <div className="error-msg" style={{marginBottom:'8px'}}>همه ساعات این روز رزرو شده است</div>}
      {!loading && slots.length > 0 && <>
        <div className="section-title">ساعت‌های آزاد</div>
        <div className="slots-grid">
          {slots.map((slot,i) => {
            const status = slot.status || (slot.available ? 'available' : 'booked')
            const isAvailable = status === 'available'
            const label = status === 'booked' ? 'رزرو شده' : status === 'break' ? 'استراحت' : status === 'blocked' ? 'بسته' : ''
            const style = !isAvailable ? {
              background: status === 'booked' ? 'rgba(180,50,50,0.25)' : status === 'break' ? 'rgba(99,51,255,0.2)' : 'rgba(255,59,48,0.2)',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'not-allowed',
              border: status === 'booked' ? '1px solid rgba(180,50,50,0.3)' : status === 'break' ? '1px solid rgba(99,51,255,0.3)' : '1px solid rgba(255,59,48,0.3)',
              fontSize: '12px'
            } : {}
            return (
            <button key={i}
              className={'slot-btn'+(selectedSlot?.start===slot.start?' selected':'')}
              onClick={() => isAvailable ? handleSlotSelect(slot) : null}
              style={style}>
              {formatTime(slot.start)}
              {label && <div style={{fontSize:'9px',marginTop:'2px',opacity:0.7}}>{label}</div>}
            </button>
          )})}
        </div>
      </>}
      <div className="bottom-padding" />
    </div>
  )

  if (screen === 'confirm') return (
    <div className="screen" dir="rtl">
      <button className="back-btn" onClick={() => setScreen('slots')}>← بازگشت</button>
      <div className="header">
        <div className="business-avatar">📋</div>
        <h1>تایید نوبت</h1>
        <p>لطفاً اطلاعات را بررسی کنید</p>
      </div>
      <div className="confirm-card">
        <div className="confirm-row">
          <span className="confirm-label">سرویس</span>
          <span className="confirm-value">{selectedService?.name}</span>
        </div>
        <div className="confirm-row">
          <span className="confirm-label">تاریخ</span>
          <span className="confirm-value">{selectedDate && formatJalaliDate(selectedDate)}</span>
        </div>
        <div className="confirm-row">
          <span className="confirm-label">ساعت</span>
          <span className="confirm-value">{selectedSlot && formatTime(selectedSlot.start)}</span>
        </div>
        <div className="confirm-row">
          <span className="confirm-label">مدت زمان</span>
          <span className="confirm-value">{toPersianNum(selectedService?.duration || 0)} دقیقه</span>
        </div>
        <div className="confirm-row">
          <span className="confirm-label">قیمت</span>
          <span className="confirm-value">{formatPrice(selectedService?.price || 0)}</span>
        </div>
      </div>
      <textarea className="note-input"
        placeholder="توضیحات یا درخواست خاص (اختیاری)..."
        value={note} onChange={e => setNote(e.target.value)} rows={3} dir="rtl" />
      {error && <div className="error-msg">{error}</div>}
      <button className="main-btn" onClick={handleConfirm} disabled={loading}>
        {loading ? 'در حال ثبت نوبت...' : 'ثبت نوبت'}
      </button>
      <div className="bottom-padding" />
    </div>
  )

  if (screen === 'success') return (
    <div className="success-screen" dir="rtl">
      <button className="back-btn" onClick={() => setScreen('services')} style={{alignSelf:'flex-start'}}>← بازگشت</button>
      <div className="success-icon-wrap">✅</div>
      <div className="success-title">نوبت ثبت شد!</div>
      <div className="success-subtitle">
        نوبت شما با موفقیت ثبت شد و یادآوری قبل از موعد دریافت خواهید کرد.
      </div>
      <div className="success-details">
        <div className="success-detail-row">
          <span className="success-detail-value">{selectedService?.name}</span>
          <span className="success-detail-label">سرویس</span>
        </div>
        <div className="success-detail-row">
          <span className="success-detail-value">{selectedDate && formatJalaliDate(selectedDate)}</span>
          <span className="success-detail-label">تاریخ</span>
        </div>
        <div className="success-detail-row">
          <span className="success-detail-value">{selectedSlot && formatTime(selectedSlot.start)}</span>
          <span className="success-detail-label">ساعت</span>
        </div>
      </div>
    </div>
  )

  return null
}
