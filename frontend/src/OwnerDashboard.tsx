import Onboarding from './Onboarding'
import { useEffect, useState } from 'react'
import axios from 'axios'
import jalaali from 'jalaali-js'

const API = 'https://bookly.kindtoy.ir/api'

const PERSIAN_MONTHS = [
  'فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور',
  'مهر','آبان','آذر','دی','بهمن','اسفند'
]

const toPersianNum = (n: number) =>
  n.toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d)])

const formatJalali = (date: Date) => {
  const { jm, jd } = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate())
  return toPersianNum(jd) + ' ' + PERSIAN_MONTHS[jm - 1]
}

const formatTime = (iso: string) => {
  const d = new Date(iso)
  const h = d.getUTCHours().toString().padStart(2, '0')
  const m = d.getUTCMinutes().toString().padStart(2, '0')
  return toPersianNum(parseInt(h)) + ':' + toPersianNum(parseInt(m))
}

const formatPrice = (price: number) => {
  if (price === 0) return 'رایگان'
  return toPersianNum(price) + ' تومان'
}

interface Appointment {
  id: string
  startTime: string
  endTime: string
  status: string
  clientNote?: string
  service: { name: string, duration: number, price: number }
  client: { firstName: string, username?: string, telegramId: string }
}

interface Service {
  id: string
  name: string
  duration: number
  price: number
}

interface WorkingHour {
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

type OwnerScreen = 'home' | 'appointments' | 'detail' | 'services' | 'hours' | 'addService' | 'share'

interface Props {
  telegramId: string
  businessSlug: string
}

export default function OwnerDashboard({ telegramId }: Props) {
  const [screen, setScreen] = useState<OwnerScreen>('home')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [todayApts, setTodayApts] = useState<Appointment[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([])
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasNoBusiness, setHasNoBusiness] = useState(false)
  const [businessSlug, setBusinessSlug] = useState('')
  // New service form
  const [newName, setNewName] = useState('')
  const [newDuration, setNewDuration] = useState('60')
  const [newPrice, setNewPrice] = useState('0')

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const [todayRes, allRes, bizRes] = await Promise.all([
        axios.get(API + '/owner/appointments', { params: { telegramId, filter: 'today' } }),
        axios.get(API + '/owner/appointments', { params: { telegramId, filter: 'upcoming' } }),
        axios.get(API + '/owner/business', { params: { telegramId } })
      ])
      setTodayApts(todayRes.data.appointments)
      setAppointments(allRes.data.appointments)
      setServices(bizRes.data.services)
      setWorkingHours(bizRes.data.workingHours)
      setBusinessSlug(bizRes.data.slug || '')
    } catch (err: any) {
      if (err.response?.status === 404) {
        setHasNoBusiness(true)
      } else {
        setError('خطا در بارگذاری')
      }
    }
    setLoading(false)
  }

  const cancelAppointment = async (id: string) => {
    try {
      await axios.patch(API + '/owner/appointments/' + id + '/cancel', { telegramId })
      await loadDashboard()
      setScreen('appointments')
    } catch {
      setError('خطا در لغو نوبت')
    }
  }

  const saveWorkingHours = async () => {
    setLoading(true)
    try {
      await axios.put(API + '/owner/working-hours', { telegramId, hours: workingHours })
      setError('')
      alert('ساعات کاری به‌روزشد!')
    } catch {
      setError('خطا در ذخیره‌سازی')
    }
    setLoading(false)
  }

  const addService = async () => {
    if (!newName || !newDuration) return
    try {
      await axios.post(API + '/owner/services', {
        telegramId,
        name: newName,
        duration: parseInt(newDuration),
        price: parseInt(newPrice) || 0
      })
      setNewName('')
      setNewDuration('60')
      setNewPrice('0')
      await loadDashboard()
      setScreen('services')
    } catch {
      setError('خطا در افزودن سرویس')
    }
  }

  const deleteService = async (id: string) => {
    try {
      await axios.delete(API + '/owner/services/' + id, { data: { telegramId } })
      await loadDashboard()
    } catch {
      setError('خطا در حذف سرویس')
    }
  }

  if (hasNoBusiness) {
    return <Onboarding telegramId={telegramId} onComplete={() => { setHasNoBusiness(false); loadDashboard() }} />
  }

  if (loading && screen === 'home') {
    return <div className="loading">در حال بارگذاری...</div>
  }

  // HOME SCREEN
  if (screen === 'home') {
    return (
      <div className="screen" dir="rtl">
        <div className="header">
          <div className="business-avatar">🏢</div>
          <h1>پنل مدیریت</h1>
          <p>خوش آمدید!</p>
        </div>

        <div className="owner-stats">
          <div className="stat-card">
            <div className="stat-number">{String(todayApts.length)}</div>
            <div className="stat-label">نوبت امروز</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{String(appointments.length)}</div>
            <div className="stat-label">نوبت آینده</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{String(services.length)}</div>
            <div className="stat-label">سرویس</div>
          </div>
        </div>

        {todayApts.length > 0 && (
          <>
            <div className="section-title">نوبت‌های امروز</div>
            {todayApts.map(apt => (
              <div key={apt.id} className="apt-card" onClick={() => { setSelectedApt(apt); setScreen('detail') }}>
                <div className="apt-time">{formatTime(apt.startTime)}</div>
                <div className="apt-info">
                  <div className="apt-service">{apt.service.name}</div>
                  <div className="apt-client">{apt.client.firstName}</div>
                </div>
                <div className="apt-arrow">›</div>
              </div>
            ))}
          </>
        )}

        {todayApts.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🏥</div>
            <div>امروز نوبتی ندارید</div>
          </div>
        )}

        <div className="owner-menu">
          <button className="menu-btn" onClick={() => setScreen('appointments')}>
            <span>📅</span>
            <span>همه نوبت‌ها</span>
          </button>
          <button className="menu-btn" onClick={() => setScreen('services')}>
            <span>✨</span>
            <span>مدیریت سرویس‌ها</span>
          </button>
          <button className="menu-btn" onClick={() => setScreen('hours')}>
            <span>⏰</span>
            <span>ساعات کاری</span>
          </button>
        </div>
        <div className="section-title">لینک رزرو نوبت</div>
        <div className="share-card">
          <div className="share-link">t.me/bookly_ir_bot?start={businessSlug}</div>
          <button className="copy-btn" onClick={() => {
            const link = 'https://t.me/bookly_ir_bot?start=' + businessSlug
            navigator.clipboard.writeText(link).then(() => {
              alert('لینک کپی شد! آن را در بیو اینستاگرام خود بگذارید')
            }).catch(() => {
              alert('https://t.me/bookly_ir_bot?start=' + businessSlug)
            })
          }}>📋 کپی لینک</button>
        </div>
        <div className="bottom-padding" />
      </div>
    )
  }

  // APPOINTMENTS SCREEN
  if (screen === 'appointments') {
    return (
      <div className="screen" dir="rtl">
        <button className="back-btn" onClick={() => setScreen('home')}>← بازگشت</button>
        <div className="header">
          <h1>نوبت‌های آینده</h1>
          <p>{toPersianNum(appointments.length)} نوبت</p>
        </div>
        {appointments.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <div>نوبتی وجود ندارد</div>
          </div>
        )}
        {appointments.map(apt => (
          <div key={apt.id} className="apt-card" onClick={() => { setSelectedApt(apt); setScreen('detail') }}>
            <div className="apt-time-col">
              <div className="apt-date">{formatJalali(new Date(apt.startTime))}</div>
              <div className="apt-time">{formatTime(apt.startTime)}</div>
            </div>
            <div className="apt-info">
              <div className="apt-service">{apt.service.name}</div>
              <div className="apt-client">{apt.client.firstName}</div>
            </div>
            <div className="apt-arrow">›</div>
          </div>
        ))}
        <div className="bottom-padding" />
      </div>
    )
  }

  // APPOINTMENT DETAIL SCREEN
  if (screen === 'detail' && selectedApt) {
    return (
      <div className="screen" dir="rtl">
        <button className="back-btn" onClick={() => setScreen('appointments')}>← بازگشت</button>
        <div className="header">
          <div className="business-avatar">📋</div>
          <h1>جزئیات نوبت</h1>
        </div>
        <div className="confirm-card">
          <div className="confirm-row">
            <span className="confirm-label">سرویس</span>
            <span className="confirm-value">{selectedApt.service.name}</span>
          </div>
          <div className="confirm-row">
            <span className="confirm-label">مشتری</span>
            <span className="confirm-value">{selectedApt.client.firstName}</span>
          </div>
          <div className="confirm-row">
            <span className="confirm-label">تاریخ</span>
            <span className="confirm-value">{formatJalali(new Date(selectedApt.startTime))}</span>
          </div>
          <div className="confirm-row">
            <span className="confirm-label">ساعت</span>
            <span className="confirm-value">{formatTime(selectedApt.startTime)}</span>
          </div>
          <div className="confirm-row">
            <span className="confirm-label">مدت</span>
            <span className="confirm-value">{toPersianNum(selectedApt.service.duration)} دقیقه</span>
          </div>
          <div className="confirm-row">
            <span className="confirm-label">قیمت</span>
            <span className="confirm-value">{formatPrice(selectedApt.service.price)}</span>
          </div>
          {selectedApt.clientNote && (
            <div className="confirm-row">
              <span className="confirm-label">توضیحات</span>
              <span className="confirm-value">{selectedApt.clientNote}</span>
            </div>
          )}
        </div>
        {error && <div className="error-msg">{error}</div>}
        <button
          className="cancel-btn"
          onClick={() => {
            if (confirm('آیا مطمئن هستید؟')) cancelAppointment(selectedApt.id)
          }}
        >
          لغو نوبت
        </button>
        <div className="bottom-padding" />
      </div>
    )
  }

  // SERVICES SCREEN
  if (screen === 'services') {
    return (
      <div className="screen" dir="rtl">
        <button className="back-btn" onClick={() => setScreen('home')}>← بازگشت</button>
        <div className="header">
          <h1>سرویس‌ها</h1>
          <p>{toPersianNum(services.length)} سرویس</p>
        </div>
        {services.map(s => (
          <div key={s.id} className="service-card">
            <div className="service-card-left">
              <div className="service-icon">✨</div>
              <div>
                <div className="service-name">{s.name}</div>
                <div className="service-meta">{toPersianNum(s.duration)} دقیقه · {formatPrice(s.price)}</div>
              </div>
            </div>
            <button
              className="delete-btn"
              onClick={() => { if (confirm('حذف شود؟')) deleteService(s.id) }}
            >
              حذف
            </button>
          </div>
        ))}
        <button className="main-btn" onClick={() => setScreen('addService')}>
          + افزودن سرویس
        </button>
        <div className="bottom-padding" />
      </div>
    )
  }

  // ADD SERVICE SCREEN
  if (screen === 'addService') {
    return (
      <div className="screen" dir="rtl">
        <button className="back-btn" onClick={() => setScreen('services')}>← بازگشت</button>
        <div className="header">
          <h1>سرویس جدید</h1>
        </div>
        <div className="form-group">
          <div className="form-label">نام سرویس</div>
          <input
            className="form-input"
            placeholder="مثلا: مانیکور"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            dir="rtl"
          />
        </div>
        <div className="form-group">
          <div className="form-label">مدت زمان (دقیقه)</div>
          <input
            className="form-input"
            type="number"
            placeholder="60"
            value={newDuration}
            onChange={e => setNewDuration(e.target.value)}
          />
        </div>
        <div className="form-group">
          <div className="form-label">قیمت (تومان)</div>
          <input
            className="form-input"
            type="number"
            placeholder="0"
            value={newPrice}
            onChange={e => setNewPrice(e.target.value)}
          />
        </div>
        {error && <div className="error-msg">{error}</div>}
        <button className="main-btn" onClick={addService} disabled={!newName}>
          افزودن سرویس
        </button>
        <div className="bottom-padding" />
      </div>
    )
  }

  // WORKING HOURS SCREEN
  if (screen === 'hours') {
    const days = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه']

    const getHour = (dow: number) =>
      workingHours.find(h => h.dayOfWeek === dow) || { dayOfWeek: dow, startTime: '09:00', endTime: '18:00', isActive: false }

    const updateHour = (dow: number, field: string, value: any) => {
      setWorkingHours(prev => {
        const existing = prev.find(h => h.dayOfWeek === dow)
        if (existing) {
          return prev.map(h => h.dayOfWeek === dow ? { ...h, [field]: value } : h)
        } else {
          return [...prev, { dayOfWeek: dow, startTime: '09:00', endTime: '18:00', isActive: false, [field]: value }]
        }
      })
    }

    return (
      <div className="screen" dir="rtl">
        <button className="back-btn" onClick={() => setScreen('home')}>← بازگشت</button>
        <div className="header">
          <h1>ساعات کاری</h1>
          <p>روزهای فعال و ساعات کار خود را تنظیم کنید</p>
        </div>
        {[6,0,1,2,3,4,5].map(dow => {
          const h = getHour(dow)
          return (
            <div key={dow} className="hours-row">
              <div className="hours-day">
                <input
                  type="checkbox"
                  checked={h.isActive}
                  onChange={e => updateHour(dow, 'isActive', e.target.checked)}
                  className="hours-check"
                />
                <span className={h.isActive ? 'hours-day-name active' : 'hours-day-name'}>{days[dow]}</span>
              </div>
              {h.isActive && (
                <div className="hours-times">
                  <input
                    type="time"
                    value={h.startTime}
                    onChange={e => updateHour(dow, 'startTime', e.target.value)}
                    className="time-input"
                  />
                  <span className="hours-to">تا</span>
                  <input
                    type="time"
                    value={h.endTime}
                    onChange={e => updateHour(dow, 'endTime', e.target.value)}
                    className="time-input"
                  />
                </div>
              )}
            </div>
          )
        })}
        {error && <div className="error-msg">{error}</div>}
        <button className="main-btn" onClick={saveWorkingHours} disabled={loading}>
          {loading ? 'در حال ذخیره‌سازی...' : 'ذخیره‌سازی ساعات کاری'}
        </button>
        <div className="bottom-padding" />
      </div>
    )
  }

  // SHARE SCREEN
  if (screen === 'share') {
    const bookingLink = 'https://t.me/bookly_ir_bot?start=' + businessSlug
    const miniAppLink = 'https://bookly.kindtoy.ir/?business=' + businessSlug + '&v=14'

    return (
      <div className="screen" dir="rtl">
        <button className="back-btn" onClick={() => setScreen('home')}>← بازگشت</button>
        <div className="header">
          <div className="business-avatar">🔗</div>
          <h1>لینک رزرو نوبت</h1>
          <p>این لینک را در اینستاگرام بیو خود بگذارید</p>
        </div>

        <div className="section-title">لینک تلگرام</div>
        <div className="share-card">
          <div className="share-link">{bookingLink}</div>
          <button className="copy-btn" onClick={() => {
            navigator.clipboard.writeText(bookingLink)
            alert('کپی شد!')
          }}>📋 کپی</button>
        </div>

        <div className="section-title">لینک مستقیم</div>
        <div className="share-card">
          <div className="share-link">{miniAppLink}</div>
          <button className="copy-btn" onClick={() => {
            navigator.clipboard.writeText(miniAppLink)
            alert('کپی شد!')
          }}>📋 کپی</button>
        </div>

        <div className="share-info">
          <div className="share-info-row">💡 لینک تلگرام را در بیو اینستاگرام خود بگذارید</div>
          <div className="share-info-row">💡 لینک مستقیم را در واتساپ یا پیام‌های خود بگذارید</div>
          <div className="share-info-row">💡 مشتریان با کلیک روی لینک می‌تونند نوبت بگیرند</div>
        </div>

        <div className="bottom-padding" />
      </div>
    )
  }

  return null
}
