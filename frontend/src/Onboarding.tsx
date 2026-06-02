import { useState } from 'react'
import axios from 'axios'

const API = 'https://bookly.kindtoy.ir/api'

const CATEGORIES = [
  { id: 'nail', label: 'نیل', icon: '💅' },
  { id: 'hair', label: 'آرایشگاه', icon: '✂️' },
  { id: 'tattoo', label: 'تاتو', icon: '🎨' },
  { id: 'lash', label: 'لش', icon: '👁️' },
  { id: 'massage', label: 'ماساژ', icon: '💆' },
  { id: 'barber', label: 'آرایشگاه مردانه', icon: '💈' },
  { id: 'clinic', label: 'کلینیک', icon: '🏥' },
  { id: 'fitness', label: 'فیتنس', icon: '💪' },
  { id: 'other', label: 'سایر', icon: '✨' },
]

const DAYS = [
  { dow: 6, label: 'شنبه' },
  { dow: 0, label: 'یکشنبه' },
  { dow: 1, label: 'دوشنبه' },
  { dow: 2, label: 'سه‌شنبه' },
  { dow: 3, label: 'چهارشنبه' },
  { dow: 4, label: 'پنجشنبه' },
  { dow: 5, label: 'جمعه' },
]

interface Service {
  name: string
  duration: string
  price: string
  breakTime: string
}

interface WorkingHour {
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

interface Props {
  telegramId: string
  onComplete: () => void
}

export default function Onboarding({ telegramId, onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [businessName, setBusinessName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')

  // Step 2
  const [services, setServices] = useState<Service[]>([
    { name: '', duration: '60', price: '0', breakTime: '0' }
  ])

  // Step 3
  const [hours, setHours] = useState<WorkingHour[]>(
    DAYS.map(d => ({
      dayOfWeek: d.dow,
      startTime: '09:00',
      endTime: '18:00',
      isActive: d.dow !== 5 // Friday off by default
    }))
  )

  const [businessSlug, setBusinessSlug] = useState('')

  const addService = () => {
    setServices([...services, { name: '', duration: '60', price: '0', breakTime: '0' }])
  }

  const removeService = (i: number) => {
    if (services.length === 1) return
    setServices(services.filter((_, idx) => idx !== i))
  }

  const updateService = (i: number, field: string, value: string) => {
    setServices(services.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  const updateHour = (dow: number, field: string, value: any) => {
    setHours(hours.map(h => h.dayOfWeek === dow ? { ...h, [field]: value } : h))
  }

  const handleStep1 = async () => {
    if (!businessName.trim()) { setError('نام کسب‌وکار الزامی است'); return }
    if (!category) { setError('دسته‌بندی را انتخاب کنید'); return }
    setError('')
    setStep(2)
  }

  const handleStep2 = () => {
    const valid = services.every(s => s.name.trim() && parseInt(s.duration) > 0)
    if (!valid) { setError('لطفاً همه سرویس‌ها را کامل کنید'); return }
    setError('')
    setStep(3)
  }

  const handleComplete = async () => {
    setLoading(true)
    setError('')
    try {
      // Create business
      const bizRes = await axios.post(API + '/owner/business', {
        telegramId, name: businessName, description, category, timezone: 'Asia/Tehran'
      })
      const slug = bizRes.data.slug
      setBusinessSlug(slug)

      // Add services one by one
      for (const s of services) {
        if (!s.name.trim()) continue
        await axios.post(API + '/owner/services', {
          telegramId,
          name: s.name.trim(),
          duration: parseInt(s.duration) || 60,
          price: parseInt(s.price) || 0,
          breakTime: parseInt(s.breakTime) || 0
        })
      }

      // Set working hours - only active days
      const activeHours = hours.filter(h => h.isActive)
      if (activeHours.length > 0) {
        await axios.put(API + '/owner/working-hours', {
          telegramId,
          hours: hours
        })
      }

      setStep(4)
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'خطا در ثبت اطلاعات'
      setError(msg)
      console.error('Onboarding error:', err.response?.data || err.message)
    }
    setLoading(false)
  }

  // STEP 1: Business Info
  if (step === 1) return (
    <div className="screen" dir="rtl">
      <div className="onboard-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: '33%' }} />
        </div>
        <div className="progress-label">مرحله ۱ از ۳</div>
      </div>
      <div className="header">
        <div className="business-avatar">🏢</div>
        <h1>اطلاعات کسب‌وکار</h1>
        <p>بیایید کسب‌وکار خود را معرفی کنید</p>
      </div>

      <div className="form-group">
        <div className="form-label">نام کسب‌وکار *</div>
        <input className="form-input" placeholder="مثلا: سالن زیبایی مریم"
          value={businessName} onChange={e => setBusinessName(e.target.value)} dir="rtl" />
      </div>

      <div className="form-group">
        <div className="form-label">توضیحات (اختیاری)</div>
        <textarea className="note-input" placeholder="مختصر درباره کسب‌وکارتان..."
          value={description} onChange={e => setDescription(e.target.value)} rows={2} dir="rtl" />
      </div>

      <div className="form-group">
        <div className="form-label">دسته‌بندی *</div>
        <div className="category-grid">
          {CATEGORIES.map(c => (
            <button key={c.id}
              className={'category-btn' + (category === c.id ? ' selected' : '')}
              onClick={() => setCategory(c.id)}>
              <span className="cat-icon">{c.icon}</span>
              <span className="cat-label">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}
      <button className="main-btn" onClick={handleStep1}>ادامه ←</button>
      <div className="bottom-padding" />
    </div>
  )

  // STEP 2: Services
  if (step === 2) return (
    <div className="screen" dir="rtl">
      <div className="onboard-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: '66%' }} />
        </div>
        <div className="progress-label">مرحله ۲ از ۳</div>
      </div>
      <div className="header">
        <div className="business-avatar">✨</div>
        <h1>سرویس‌ها</h1>
        <p>خدماتی که ارائه می‌دهید را تعریف کنید</p>
      </div>

      {services.map((s, i) => (
        <div key={i} className="service-form-card">
          <div className="service-form-header">
            <span>سرویس {i + 1}</span>
            {services.length > 1 && (
              <button className="delete-btn" onClick={() => removeService(i)}>حذف</button>
            )}
          </div>
          <div className="form-group">
            <div className="form-label">نام</div>
            <input className="form-input" placeholder="مثلا: مانیکور"
              value={s.name} onChange={e => updateService(i, 'name', e.target.value)} dir="rtl" />
          </div>
          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <div className="form-label">مدت (دقیقه)</div>
              <input className="form-input" type="number" placeholder="60"
                value={s.duration} onChange={e => updateService(i, 'duration', e.target.value)} />
            </div>
            <div className="form-group" style={{flex:1}}>
              <div className="form-label">قیمت (تومان)</div>
              <input className="form-input" type="number" placeholder="0"
                value={s.price} onChange={e => updateService(i, 'price', e.target.value)} />
              <input className="service-input" type="number" placeholder="استراحت (دقیقه)"
                value={s.breakTime} onChange={e => updateService(i, 'breakTime', e.target.value)} />
            </div>
          </div>
        </div>
      ))}

      <button className="add-service-btn" onClick={addService}>+ افزودن سرویس</button>

      {error && <div className="error-msg">{error}</div>}
      <div className="btn-row">
        <button className="back-btn" onClick={() => setStep(1)}>→ بازگشت</button>
        <button className="main-btn" style={{flex:1}} onClick={handleStep2}>ادامه ←</button>
      </div>
      <div className="bottom-padding" />
    </div>
  )

  // STEP 3: Working Hours
  if (step === 3) return (
    <div className="screen" dir="rtl">
      <div className="onboard-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: '100%' }} />
        </div>
        <div className="progress-label">مرحله ۳ از ۳</div>
      </div>
      <div className="header">
        <div className="business-avatar">⏰</div>
        <h1>ساعات کاری</h1>
        <p>روزها و ساعات فعالیت خود را تعیین کنید</p>
      </div>

      {DAYS.map(({ dow, label }) => {
        const h = hours.find(h => h.dayOfWeek === dow)!
        return (
          <div key={dow} className="hours-row">
            <div className="hours-day">
              <input type="checkbox" checked={h.isActive}
                onChange={e => updateHour(dow, 'isActive', e.target.checked)}
                className="hours-check" />
              <span className={h.isActive ? 'hours-day-name active' : 'hours-day-name'}>{label}</span>
            </div>
            {h.isActive && (
              <div className="hours-times">
                <input type="time" value={h.startTime}
                  onChange={e => updateHour(dow, 'startTime', e.target.value)}
                  className="time-input" />
                <span className="hours-to">تا</span>
                <input type="time" value={h.endTime}
                  onChange={e => updateHour(dow, 'endTime', e.target.value)}
                  className="time-input" />
              </div>
            )}
          </div>
        )
      })}

      {error && <div className="error-msg">{error}</div>}
      <div className="btn-row">
        <button className="back-btn" onClick={() => setStep(2)}>→ بازگشت</button>
        <button className="main-btn" style={{flex:1}} onClick={handleComplete} disabled={loading}>
          {loading ? 'در حال ثبت...' : 'ثبت و شروع ←'}
        </button>
      </div>
      <div className="bottom-padding" />
    </div>
  )

  // STEP 4: Done
  return (
    <div className="success-screen" dir="rtl">
      <div className="success-icon-wrap">🎉</div>
      <div className="success-title">کسب‌وکار شما آماده است!</div>
      <div className="success-subtitle">
        لینک اختصاصی رزرو نوبت شما آماده شد
      </div>
      <div className="link-card">
        <div className="link-label">لینک رزرو نوبت</div>
        <div className="link-value">bookly.kindtoy.ir/?business={businessSlug}</div>
      </div>
      <button className="main-btn" onClick={onComplete}>
        رفتن به پنل مدیریت
      </button>
    </div>
  )
}
