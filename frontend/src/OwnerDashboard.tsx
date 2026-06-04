import { Sparkles, Clock, Scissors, CheckCircle2, XCircle, Settings } from 'lucide-react'
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
  const tehran = new Date(d.getTime() + 210 * 60 * 1000)
  const h = tehran.getUTCHours().toString().padStart(2, '0')
  const m = tehran.getUTCMinutes().toString().padStart(2, '0')
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

type OwnerScreen = 'selectBusiness' | 'home' | 'appointments' | 'detail' | 'services' | 'hours' | 'addService' | 'share' | 'settings' | 'editBusiness' | 'editService' | 'manageSlots'

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
  const [businesses, setBusinesses] = useState<any[]>([])
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null)
  const [businessSlug, setBusinessSlug] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editingService, setEditingService] = useState<any>(null)
  const [slotsDate, setSlotsDate] = useState('')
  const [blockedSlots, setBlockedSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [bookedSlots, setBookedSlots] = useState<string[]>([])
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pickerJYear, setPickerJYear] = useState(0)
  const [pickerJMonth, setPickerJMonth] = useState(0)
  const [editServiceName, setEditServiceName] = useState('')
  const [editServiceDuration, setEditServiceDuration] = useState('')
  const [editServicePrice, setEditServicePrice] = useState('')
  const [editServiceBreak, setEditServiceBreak] = useState('')
  const [editError, setEditError] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [delError, setDelError] = useState('')
  const [avatarTs, setAvatarTs] = useState(Date.now())
  // New service form
  const [newName, setNewName] = useState('')
  const [newDuration, setNewDuration] = useState('60')
  const [newPrice, setNewPrice] = useState('0')
  const [newBreakTime, setNewBreakTime] = useState('0')

  useEffect(() => {
    loadDashboard()
  }, [])



  const loadDashboard = async (bizId?: string) => {
    const activeBizId = bizId || selectedBusinessId || undefined
    setLoading(true)
    try {
      // Load all businesses first
      const allBizRes = await axios.get(API + '/owner/businesses', { params: { telegramId } })
      const bizList2 = allBizRes.data.businesses || []
      setBusinesses(bizList2)
      if ((allBizRes.data.businesses || []).length === 0) {
        setHasNoBusiness(true)
        setLoading(false)
        return
      }
      const bizList = allBizRes.data.businesses || []
      if (bizList.length > 1 && !activeBizId) {
        setScreen('selectBusiness')
        setLoading(false)
        return
      }
      // If selectedBusinessId is set, use that business
      if (activeBizId) {
        const selBiz = bizList.find((b: any) => b.id === activeBizId)
        if (selBiz) {
          setBusinessSlug(selBiz.slug || '')
          setBusinessName(selBiz.name || '')
          setEditName(selBiz.name || '')
          setServices(selBiz.services || [])
        }
      }

      const [todayRes, allRes, bizRes] = await Promise.all([
        axios.get(API + '/owner/appointments', { params: { telegramId, filter: 'today', businessId: activeBizId } }),
        axios.get(API + '/owner/appointments', { params: { telegramId, filter: 'upcoming', businessId: activeBizId } }),
        (() => { console.log('Loading business with activeBizId:', activeBizId); return axios.get(API + '/owner/business', { params: { telegramId, businessId: activeBizId } }) })()
      ])
      setTodayApts(todayRes.data.appointments)
      setAppointments(allRes.data.appointments)
      setServices(bizRes.data.services)
      setWorkingHours(bizRes.data.workingHours)
      setBusinessSlug(bizRes.data.slug || '')
      setBusinessName(bizRes.data.name || '')
      setEditName(bizRes.data.name || '')
      setEditDesc(bizRes.data.description || '')
      setEditCategory(bizRes.data.category || '')
      // Load avatar
      try {
        const avatarRes = await axios.get(API + '/owner/avatar', { params: { telegramId, businessId: activeBizId } })
        setAvatarUrl(avatarRes.data.avatarUrl)
      } catch {}
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
      await axios.patch(API + '/appointments/' + id + '/cancel', { cancelledBy: 'owner' })
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
        price: parseInt(newPrice) || 0,
        breakTime: parseInt(newBreakTime) || 0,
        businessId: selectedBusinessId || undefined
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
          <label className="avatar-upload-wrap" htmlFor="avatar-input" style={{cursor:'pointer'}}>
            {avatarUrl ? (
              <img src={'https://bookly.kindtoy.ir' + avatarUrl + '?t=' + avatarTs} className="business-avatar-img" alt="avatar" />
            ) : (
              <div className="business-avatar"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg></div>
            )}
            <div className="avatar-edit-badge">{uploading ? '...' : '✏️'}</div>
          </label>
          <input
            id="avatar-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              if (file.size > 5 * 1024 * 1024) {
                alert('حجم عکس باید کمتر از 5 مگابایت باشد')
                return
              }
              setUploading(true)
              // Resize image in browser before upload
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')!
              const img = new Image()
              img.onload = async () => {
                const size = 400
                canvas.width = size
                canvas.height = size
                const scale = Math.max(size / img.width, size / img.height)
                const x = (size - img.width * scale) / 2
                const y = (size - img.height * scale) / 2
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
                const base64 = dataUrl.split(',')[1]
                try {
                  const response = await fetch(API + '/owner/upload-avatar-base64', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ telegramId, base64, mimeType: 'image/jpeg' })
                  })
                  const res = await response.json()
                  if (!response.ok) throw new Error(res.error || 'Upload failed')
                  setAvatarUrl(res.avatarUrl)
                  setAvatarTs(Date.now())
                  alert('عکس با موفقیت آپلود شد!')
                } catch (err: any) {
                  alert('خطا: ' + (err.message || 'unknown'))
                }
                setUploading(false)
                URL.revokeObjectURL(img.src)
              }
              img.onerror = () => {
                alert('خطا در بارگذاری عکس')
                setUploading(false)
              }
              img.src = URL.createObjectURL(file)
              setUploading(false)
            }}
          />
          <h1>{businessName || 'پنل مدیریت'}</h1>
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
            <span style={{display:'flex',alignItems:'center'}}><Sparkles size={18} color='#C9A84C' /></span>
            <span>مدیریت سرویس‌ها</span>
          </button>
          <button className="menu-btn" onClick={() => setScreen('hours')}>
            <span style={{display:'flex',alignItems:'center'}}><Clock size={18} color='#a78bfa' /></span>
            <span>ساعات کاری</span>
          </button>
          <button className="menu-btn" onClick={() => setScreen('manageSlots')}>
            <span>🚫</span>
            <span>مسدود کردن ساعات</span>
          </button>
          <button className="menu-btn" onClick={() => setScreen('share')}>
            <span>🔗</span>
            <span>لینک رزرو نوبت</span>
          </button>
          <button className="menu-btn" onClick={() => setScreen('settings')}>
            <span style={{display:"flex",alignItems:"center"}}><Settings size={18} color="rgba(255,255,255,0.6)" /></span>
            <span>تنظیمات</span>
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
          <div className="business-avatar"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg></div>
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
              <div className="service-icon"><span style={{display:'flex',alignItems:'center'}}><Scissors size={16} color='#C9A84C' /></span></div>
              <div>
                <div className="service-name">{s.name}</div>
                <div className="service-meta">{toPersianNum(s.duration)} دقیقه · {formatPrice(s.price)}</div>
              </div>
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              <button
                className="delete-btn"
                style={{background:'rgba(99,51,255,0.2)',color:'#a78bfa'}}
                onClick={() => {
                  setEditingService(s)
                  setEditServiceName(s.name)
                  setEditServiceDuration(String(s.duration))
                  setEditServicePrice(String(s.price))
                  setEditServiceBreak(String((s as any).break_time || 0))
                  setScreen('editService')
                }}
              >
                ویرایش
              </button>
              <button
                className="delete-btn"
                onClick={() => { if (confirm('حذف شود؟')) deleteService(s.id) }}
              >
                حذف
              </button>
            </div>
          </div>
        ))}
        <button className="main-btn" onClick={() => { setScreen('addService'); setError('') }}>
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
        <div className="form-group">
          <div className="form-label">زمان استراحت بعد از سرویس (دقیقه)</div>
          <input
            className="form-input"
            type="number"
            placeholder="0"
            value={newBreakTime}
            onChange={e => setNewBreakTime(e.target.value)}
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
    const miniAppLink = 'https://bookly.kindtoy.ir/app?business=' + businessSlug + '&v=58'

    return (
      <div className="screen" dir="rtl">
        <button className="back-btn" onClick={() => setScreen('home')}>← بازگشت</button>
        <div className="header">
          <div className="business-avatar"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg></div>
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

  // SETTINGS SCREEN
  if (screen === 'settings') {

    const handleDelete = async () => {
      if (!confirm('آیا مطمئن هستید؟\n\nاین کار غیرقابل برگشت است. همه سرویس‌ها و ساعات کاری حذف خواهند شد.')) return
      setDeleting(true)
      setDelError('')
      try {
        await axios.delete(API + '/owner/business', { data: { telegramId, businessId: selectedBusinessId || undefined } })
        alert('کسب‌وکار با موفقیت حذف شد')
        window.location.reload()
      } catch (err: any) {
        setDelError(err.response?.data?.error || 'خطا در حذف')
      }
      setDeleting(false)
    }

    return (
      <div className="screen" dir="rtl">
        <button className="back-btn" onClick={() => setScreen('home')}>← بازگشت</button>
        <div className="header">
          <div className="business-avatar"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg></div>
          <h1>تنظیمات</h1>
        </div>

        <button className="menu-btn" onClick={() => setScreen('editBusiness')} style={{marginBottom:'16px'}}>
          <span>✏️</span>
          <span>ویرایش اطلاعات</span>
        </button>
        <div className="section-title">اطلاعات کسب‌وکار</div>
        <div className="confirm-card">
          <div className="confirm-row">
            <span className="confirm-label">نام</span>
            <span className="confirm-value">{businessName}</span>
          </div>
          <div className="confirm-row">
            <span className="confirm-label">لینک</span>
            <span className="confirm-value" style={{fontSize:'12px', color:'#a78bfa'}}>{businessSlug}</span>
          </div>
          <div className="confirm-row">
            <span className="confirm-label">سرویس‌ها</span>
            <span className="confirm-value">{services.length} سرویس</span>
          </div>
        </div>

        <div className="section-title" style={{marginTop:'16px'}}>کسب‌وکار جدید</div>
        <button className="menu-btn" onClick={() => setHasNoBusiness(true)} style={{marginBottom:'24px'}}>
          <span>➕</span>
          <span>اضافه کردن کسب‌وکار جدید</span>
        </button>

        <div className="section-title" style={{marginTop:'8px', color:'#ff6b6b'}}>منطقه خطرناک</div>
        <div style={{background:'rgba(255,59,48,0.06)', border:'1px solid rgba(255,59,48,0.15)', borderRadius:'16px', padding:'20px', marginBottom:'12px'}}>
          <div style={{fontSize:'15px', fontWeight:'700', marginBottom:'8px'}}>حذف کسب‌وکار</div>
          <div style={{fontSize:'13px', color:'rgba(255,255,255,0.5)', lineHeight:'1.6', marginBottom:'16px'}}>
            با حذف کسب‌وکار، همه سرویس‌ها، ساعات کاری و تاریخچه نوبت‌ها حذف خواهند شد. این عمل غیرقابل برگشت است.
          </div>
          {delError && <div className="error-msg">{delError}</div>}
          <button className="cancel-btn" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'در حال حذف...' : 'حذف کسب‌وکار'}
          </button>
        </div>
        <div className="bottom-padding" />
      </div>
    )
  }

  // EDIT BUSINESS SCREEN
  if (screen === 'editBusiness') {

    const categories = [
      { value: 'hair', label: 'آرایشگاه' },
      { value: 'nail', label: 'ناخن و مانیکور' },
      { value: 'beauty', label: 'زیبایی' },
      { value: 'massage', label: 'ماساژ' },
      { value: 'tattoo', label: 'تاتو' },
      { value: 'fitness', label: 'ورزش' },
      { value: 'other', label: 'سایر' },
    ]

    const handleSave = async () => {
      if (!editName.trim()) { setEditError('نام الزامی است'); return }
      setEditSaving(true)
      setEditError('')
      try {
        await axios.patch(API + '/owner/business', {
          telegramId,
          name: editName,
          description: editDesc,
          category: editCategory
        })
        setBusinessName(editName)
        alert('اطلاعات به‌روز شد!')
        setScreen('settings')
      } catch {
        setEditError('خطا در ذخیره‌سازی')
      }
      setEditSaving(false)
    }

    return (
      <div className="screen" dir="rtl">
        <button className="back-btn" onClick={() => setScreen('settings')}>← بازگشت</button>
        <div className="header">
          <div className="business-avatar"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
          <h1>ویرایش اطلاعات</h1>
        </div>

        <div className="section-title">نام کسب‌وکار</div>
        <input
          className="text-input"
          value={editName}
          onChange={e => setEditName(e.target.value)}
          placeholder="نام کسب‌وکار"
        />

        <div className="section-title">توضیحات</div>
        <textarea
          className="text-input"
          value={editDesc}
          onChange={e => setEditDesc(e.target.value)}
          placeholder="توضیحات کسب‌وکار (اختیاری)"
          rows={3}
          style={{resize:'none'}}
        />

        <div className="section-title">دسته‌بندی</div>
        <div style={{display:'flex', flexWrap:'wrap', gap:'8px', marginBottom:'24px'}}>
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setEditCategory(cat.value)}
              style={{
                padding:'10px 16px',
                borderRadius:'50px',
                border: editCategory === cat.value ? '2px solid #6333ff' : '1px solid rgba(255,255,255,0.1)',
                background: editCategory === cat.value ? 'rgba(99,51,255,0.2)' : 'transparent',
                color: 'white',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >{cat.label}</button>
          ))}
        </div>

        {editError && <div className="error-msg">{editError}</div>}
        <button className="main-btn" onClick={handleSave} disabled={editSaving}>
          {editSaving ? 'در حال ذخیره‌سازی...' : 'ذخیره‌سازی'}
        </button>
        <div className="bottom-padding" />
      </div>
    )
  }

  // SELECT BUSINESS SCREEN
  if (screen === 'selectBusiness') {
    return (
      <div className="screen" dir="rtl">
        <div className="header">
          <div className="business-avatar"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg></div>
          <h1>کسب‌وکار خود را انتخاب کنید</h1>
          <p>برای مدیریت کدام کسب‌وکار وارد شوید؟</p>
        </div>

        <div className="menu-grid">
          {businesses.map(biz => (
            <button
              key={biz.id}
              className="menu-btn"
              onClick={async () => {
                setSelectedBusinessId(biz.id)
                if (biz.avatarUrl) {
                  setAvatarUrl(biz.avatarUrl)
                  setAvatarTs(Date.now())
                } else {
                  setAvatarUrl(null)
                }
                setScreen('home')
                loadDashboard(biz.id)
              }}
            >
              {biz.avatarUrl ? (
                <img src={'https://bookly.kindtoy.ir' + biz.avatarUrl} style={{width:'32px',height:'32px',borderRadius:'8px',objectFit:'cover'}} alt="" />
              ) : (
                <div style={{width:"32px",height:"32px",borderRadius:"8px",background:"linear-gradient(135deg,#6333ff,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",fontWeight:"900",color:"white",flexShrink:0}}>{biz.name.charAt(0)}</div>
              )}
              <span>{biz.name}</span>
            </button>
          ))}
        </div>

        <div style={{marginTop:'24px'}}>
          <button className="main-btn" onClick={() => {
            setHasNoBusiness(true)
          }}>
            ➕ کسب‌وکار جدید
          </button>
        </div>
        <div className="bottom-padding" />
      </div>
    )
  }

  // EDIT SERVICE SCREEN
  if (screen === 'editService' && editingService) {
    const handleEditService = async () => {
      if (!editServiceName || !editServiceDuration) return
      setEditSaving(true)
      try {
        await axios.patch(API + '/owner/services/' + editingService.id, {
          telegramId,
          name: editServiceName,
          duration: parseInt(editServiceDuration),
          price: parseInt(editServicePrice) || 0,
          breakTime: parseInt(editServiceBreak) || 0
        })
        await loadDashboard(selectedBusinessId || undefined)
        setScreen('services')
      } catch {
        alert('خطا در ویرایش')
      }
      setEditSaving(false)
    }

    return (
      <div className="screen" dir="rtl">
        <button className="back-btn" onClick={() => setScreen('services')}>← بازگشت</button>
        <div className="header">
          <div className="business-avatar"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
          <h1>ویرایش سرویس</h1>
        </div>

        <div className="form-group">
          <div className="form-label">نام سرویس</div>
          <input className="form-input" value={editServiceName} onChange={e => setEditServiceName(e.target.value)} placeholder="نام سرویس" />
        </div>

        <div className="form-group">
          <div className="form-label">مدت زمان (دقیقه)</div>
          <input className="form-input" type="number" value={editServiceDuration} onChange={e => setEditServiceDuration(e.target.value)} />
        </div>

        <div className="form-group">
          <div className="form-label">قیمت (تومان)</div>
          <input className="form-input" type="number" value={editServicePrice} onChange={e => setEditServicePrice(e.target.value)} />
        </div>

        <div className="form-group">
          <div className="form-label">زمان استراحت بعد از سرویس (دقیقه)</div>
          <input className="form-input" type="number" value={editServiceBreak} onChange={e => setEditServiceBreak(e.target.value)} />
        </div>

        <button className="main-btn" onClick={handleEditService} disabled={editSaving}>
          {editSaving ? 'در حال ذخیره‌سازی...' : 'ذخیره‌سازی'}
        </button>
        <div className="bottom-padding" />
      </div>
    )
  }

  // MANAGE SLOTS SCREEN
  if (screen === 'manageSlots') {
    const loadBlockedSlots = async (date: string) => {
      setSlotsLoading(true)
      try {
        const res = await axios.get(API + '/owner/blocked-slots', { params: { telegramId, date, businessId: selectedBusinessId || undefined } })
        setBlockedSlots(res.data.blocked || [])
        setBookedSlots(res.data.booked || [])
      } catch {}
      setSlotsLoading(false)
    }

    const toggleSlot = async (slotTime: string) => {
      try {
        const res = await axios.post(API + '/owner/blocked-slots', {
          telegramId, date: slotsDate, slotTime, businessId: selectedBusinessId || undefined
        })
        if (res.data.blocked) {
          setBlockedSlots(prev => [...prev, slotTime])
        } else {
          setBlockedSlots(prev => prev.filter(s => s !== slotTime))
        }
      } catch (err: any) {
        alert(err.response?.data?.error || '\خ\ط\ا')
      }
    }

    // Generate 30-min slots from working hours
    const generateSlots = () => {
      const slots = []
      for (let h = 9; h < 18; h++) {
        slots.push(h.toString().padStart(2,'0') + ':00')
        slots.push(h.toString().padStart(2,'0') + ':30')
      }
      return slots
    }

    return (
      <div className="screen" dir="rtl">
        <button className="back-btn" onClick={() => setScreen('home')}>← بازگشت</button>
        <div className="header">
          <div className="business-avatar"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg></div>
          <h1>مسدود کردن ساعات</h1>
          <p>اسلاتی که نمیخواید رزرو بشن را ببندید</p>
        </div>

        <div className="section-title">انتخاب تاریخ</div>
        <div style={{display:'flex',gap:'8px',marginBottom:'24px',flexWrap:'wrap'}}>
          {[0,1,2,3,4,5,6].map(offset => {
            const d = new Date()
            d.setDate(d.getDate() + offset)
            const dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
            const jalali = jalaali.toJalaali(d.getFullYear(), d.getMonth()+1, d.getDate())
            const dayNames = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه']
            const dayName = offset === 0 ? 'امروز' : offset === 1 ? 'فردا' : dayNames[d.getDay()]
            const isSelected = slotsDate === dateStr
            return (
              <button
                key={dateStr}
                onClick={async () => { setSlotsDate(dateStr); await loadBlockedSlots(dateStr) }}
                style={{
                  padding:'10px 14px',
                  borderRadius:'12px',
                  border: isSelected ? '2px solid #6333ff' : '1px solid rgba(255,255,255,0.1)',
                  background: isSelected ? 'rgba(99,51,255,0.2)' : 'rgba(255,255,255,0.04)',
                  color: 'white',
                  fontSize:'13px',
                  fontWeight: isSelected ? '800' : '400',
                  cursor:'pointer',
                  fontFamily:'Vazirmatn,sans-serif',
                  textAlign:'center'
                }}
              >
                <div>{dayName}</div>
                <div style={{fontSize:'11px',color:'#C9A84C',marginTop:'2px'}}>{toPersianNum(jalali.jd)} / {toPersianNum(jalali.jm)}</div>
              </button>
            )
          })}
        </div>


        <button
          onClick={() => {
            const now = jalaali.toJalaali(new Date().getFullYear(), new Date().getMonth()+1, new Date().getDate())
            setPickerJYear(now.jy)
            setPickerJMonth(now.jm)
            setShowDatePicker(true)
          }}
          style={{
            width:'100%', padding:'12px', borderRadius:'14px',
            border:'1px dashed rgba(255,255,255,0.2)', background:'transparent',
            color:'rgba(255,255,255,0.6)', fontSize:'14px', cursor:'pointer',
            fontFamily:'Vazirmatn,sans-serif', marginBottom:'16px'
          }}
        >
          📅 انتخاب تاریخ دیگر...
        </button>

        {showDatePicker && (
          <div style={{
            background:'rgba(20,0,5,0.98)', border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:'20px', padding:'20px', marginBottom:'16px'
          }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
              <button onClick={() => { if(pickerJMonth===1){setPickerJMonth(12);setPickerJYear(y=>y-1)}else setPickerJMonth(m=>m-1) }}
                style={{background:'none',border:'none',color:'white',fontSize:'20px',cursor:'pointer'}}>‹</button>
              <div style={{fontWeight:'700',fontSize:'16px'}}>
                {['','فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'][pickerJMonth]} {toPersianNum(pickerJYear)}
              </div>
              <button onClick={() => { if(pickerJMonth===12){setPickerJMonth(1);setPickerJYear(y=>y+1)}else setPickerJMonth(m=>m+1) }}
                style={{background:'none',border:'none',color:'white',fontSize:'20px',cursor:'pointer'}}>›</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px',textAlign:'center',marginBottom:'8px'}}>
              {['ش','ی','د','س','چ','پ','ج'].map(d => (
                <div key={d} style={{fontSize:'11px',color:'rgba(255,255,255,0.3)',padding:'4px'}}>{d}</div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px'}}>
              {(() => {
                const days = []
                const firstDay = jalaali.toGregorian(pickerJYear, pickerJMonth, 1)
                const firstDate = new Date(firstDay.gy, firstDay.gm-1, firstDay.gd)
                let startDow = (firstDate.getDay() + 1) % 7
                for(let i=0;i<startDow;i++) days.push(<div key={'e'+i}></div>)
                const daysInMonth = pickerJMonth <= 6 ? 31 : pickerJMonth <= 11 ? 30 : jalaali.isLeapJalaaliYear(pickerJYear) ? 30 : 29
                for(let d=1;d<=daysInMonth;d++) {
                  const greg = jalaali.toGregorian(pickerJYear, pickerJMonth, d)
                  const dateStr = greg.gy + '-' + String(greg.gm).padStart(2,'0') + '-' + String(greg.gd).padStart(2,'0')
                  const isPast = new Date(dateStr) < new Date(new Date().toDateString())
                  const isSelected = slotsDate === dateStr
                  days.push(
                    <button
                      key={d}
                      disabled={isPast}
                      onClick={async () => {
                        setSlotsDate(dateStr)
                        setShowDatePicker(false)
                        await loadBlockedSlots(dateStr)
                      }}
                      style={{
                        padding:'8px 4px', borderRadius:'8px', border:'none',
                        background: isSelected ? '#6333ff' : isPast ? 'transparent' : 'rgba(255,255,255,0.04)',
                        color: isPast ? 'rgba(255,255,255,0.2)' : 'white',
                        fontSize:'13px', cursor: isPast ? 'default' : 'pointer',
                        fontFamily:'Vazirmatn,sans-serif'
                      }}
                    >{toPersianNum(d)}</button>
                  )
                }
                return days
              })()}
            </div>
            <button onClick={() => setShowDatePicker(false)}
              style={{width:'100%',marginTop:'12px',padding:'10px',borderRadius:'10px',
                border:'none',background:'rgba(255,255,255,0.06)',color:'white',cursor:'pointer',
                fontFamily:'Vazirmatn,sans-serif'}}>
              بستن
            </button>
          </div>
        )}

        {slotsDate && (
          <>
            <div className="section-title">
              اسلات‌ها — سبز = باز · قرمز = بسته
            </div>
            {slotsLoading ? (
              <div style={{textAlign:'center',padding:'20px',color:'rgba(255,255,255,0.4)'}}>
                در حال بارگذاری...
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',marginBottom:'24px'}}>
                {generateSlots().map(slot => {
                  const isBlocked = blockedSlots.includes(slot)
                  return (
                    <button
                      key={slot}
                      onClick={() => !bookedSlots.includes(slot) && toggleSlot(slot)}
                      style={{
                        padding:'12px 8px',
                        borderRadius:'12px',
                        border:'none',
                        background: bookedSlots.includes(slot) ? 'rgba(120,120,120,0.1)' : isBlocked ? 'rgba(255,59,48,0.2)' : 'rgba(52,199,89,0.15)',
                        color: bookedSlots.includes(slot) ? 'rgba(255,255,255,0.2)' : isBlocked ? '#ff6b6b' : '#4ade80',
                        fontSize:'14px',
                        fontWeight:'700',
                        cursor: bookedSlots.includes(slot) ? 'not-allowed' : 'pointer',
                        fontFamily:'Vazirmatn,sans-serif',
                        transition:'all 0.2s'
                      }}
                    >
                      {slot}
                      <div style={{fontSize:'10px',marginTop:'2px'}}>
                        {bookedSlots.includes(slot) ? '-' : isBlocked ? <XCircle size={14} color='#ff6b6b' /> : <CheckCircle2 size={14} color='#4ade80' />}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
        <div className="bottom-padding" />
      </div>
    )
  }

  return null
}
// cache bust Wed Jun  3 12:52:29 UTC 2026
