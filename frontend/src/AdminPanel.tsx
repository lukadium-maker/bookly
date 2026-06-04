import { useEffect, useState } from 'react'
import axios from 'axios'
import { Download, Briefcase, Calendar, Building2, Shield } from 'lucide-react'

const API = 'https://bookly.kindtoy.ir/api'

const ownerAxios = axios.create({ baseURL: API })
ownerAxios.interceptors.request.use((cfg: any) => {
  const tg = (window as any).Telegram?.WebApp
  const id = tg?.initData || ''
  if (id) cfg.headers['x-telegram-init-data'] = id
  return cfg
})

const CATEGORY_LABELS: Record<string, string> = {
  hair: 'آرایشگاه',
  beauty: 'زیبایی',
  nail: 'ناخن',
  lash: 'لش',
  skin: 'پوست',
  massage: 'ماساژ',
  other: 'سایر'
}

export default function AdminPanel({ telegramId }: { telegramId: string }) {
  const [businesses, setBusinesses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [backupLoading, setBackupLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ownerAxios.get('/admin/businesses', { params: { telegramId } })
      .then(res => { setBusinesses(res.data.businesses); setLoading(false) })
      .catch((err) => { setError('خطا: ' + (err.response?.data?.error || err.message)); setLoading(false) })
  }, [])

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#0D0001',color:'white',fontFamily:'Vazirmatn,sans-serif'}}>
      در حال بارگذاری...
    </div>
  )

  if (error) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#0D0001',color:'#ff6b6b',fontFamily:'Vazirmatn,sans-serif'}}>
      {error}
    </div>
  )

  const totalAppointments = businesses.reduce((sum, b) => sum + (b._count?.appointments || 0), 0)
  const totalServices = businesses.reduce((sum, b) => sum + (b.services?.length || 0), 0)

  return (
    <div style={{background:'linear-gradient(160deg,#1A0003,#0D0001)',minHeight:'100vh',padding:'24px 16px',fontFamily:'Vazirmatn,sans-serif',direction:'rtl',color:'white'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'24px'}}>
        <div style={{
          width:'48px',height:'48px',borderRadius:'14px',
          background:'linear-gradient(135deg,#C9A84C,#E8C97A)',
          display:'flex',alignItems:'center',justifyContent:'center'
        }}>
          <Shield size={24} color="#1A0003" />
        </div>
        <div>
          <h1 style={{fontSize:'20px',fontWeight:'900',color:'white',margin:0}}>پنل ادمین بوکلی</h1>
          <p style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',margin:0}}>مدیریت کل پلتفرم</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginBottom:'20px'}}>
        {[
          { icon: <Building2 size={18} color="#C9A84C" />, value: businesses.length, label: 'کسب‌وکار' },
          { icon: <Calendar size={18} color="#6333ff" />, value: totalAppointments, label: 'نوبت' },
          { icon: <Briefcase size={18} color="#4ade80" />, value: totalServices, label: 'سرویس' },
        ].map((stat, i) => (
          <div key={i} style={{
            background:'rgba(255,255,255,0.04)',
            border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:'14px',padding:'14px 10px',textAlign:'center'
          }}>
            <div style={{display:'flex',justifyContent:'center',marginBottom:'6px'}}>{stat.icon}</div>
            <div style={{fontSize:'20px',fontWeight:'900'}}>{stat.value}</div>
            <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Backup Button */}
      <button
        onClick={async () => {
          setBackupLoading(true)
          try {
            const tgInitData = (window as any).Telegram?.WebApp?.initData || ''
            const res = await fetch(API + '/admin/backup?telegramId=' + telegramId, { headers: { 'x-telegram-init-data': tgInitData } })
            const data = await res.json()
            navigator.clipboard.writeText(data.url).then(() => {
              alert('لینک کپی شد!\n\n' + data.url + '\n\nاین لینک را در مرورگر باز کنید و فایل را دانلود کنید')
            }).catch(() => {
              alert('لینک backup:\n' + data.url)
            })
          } catch { alert('خطا در دریافت backup') }
          setBackupLoading(false)
        }}
        style={{
          width:'100%',
          display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
          background:'linear-gradient(135deg,#C9A84C,#E8C97A)',
          color:'#1A0003',border:'none',borderRadius:'14px',
          padding:'14px 24px',fontWeight:'800',fontSize:'14px',
          cursor:'pointer',marginBottom:'20px',
          fontFamily:'Vazirmatn,sans-serif'
        }}
      >
        <Download size={18} />
        {backupLoading ? 'در حال آماده‌سازی...' : 'دانلود Backup دیتابیس'}
      </button>

      {/* Business List */}
      <div style={{fontSize:'12px',color:'rgba(255,255,255,0.3)',marginBottom:'12px',display:'flex',alignItems:'center',gap:'6px'}}>
        <Building2 size={13} />
        لیست کسب‌وکارها
      </div>

      {businesses.map(biz => (
        <div key={biz.id} style={{
          background:'rgba(255,255,255,0.04)',
          border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:'16px',padding:'16px',marginBottom:'10px'
        }}>
          <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'12px'}}>
            {biz.avatarUrl ? (
              <img src={'https://bookly.kindtoy.ir' + biz.avatarUrl} style={{width:'44px',height:'44px',borderRadius:'12px',objectFit:'cover'}} alt="" />
            ) : (
              <div style={{
                width:'44px',height:'44px',borderRadius:'12px',
                background:'rgba(99,51,255,0.2)',
                display:'flex',alignItems:'center',justifyContent:'center'
              }}>
                <Building2 size={22} color="#6333ff" />
              </div>
            )}
            <div style={{flex:1}}>
              <div style={{fontWeight:'800',fontSize:'15px'}}>{biz.name}</div>
              <div style={{fontSize:'11px',color:'#C9A84C',marginTop:'2px'}}>{biz.slug}</div>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
            {[
              { label: 'مالک', text: biz.owner?.firstName || '-' },
              { label: 'دسته', text: CATEGORY_LABELS[biz.category] || biz.category || '-' },
              { label: 'سرویس', text: (biz.services?.length || 0) + ' عدد' },
              { label: 'نوبت', text: (biz._count?.appointments || 0) + ' عدد' },
            ].map((item: any, i: number) => (
              <div key={i} style={{
                display:'flex',flexDirection:'column',gap:'2px',
                fontSize:'12px',color:'rgba(255,255,255,0.5)',
                background:'rgba(255,255,255,0.03)',
                borderRadius:'8px',padding:'7px 10px'
              }}>
    <span style={{color:'rgba(255,255,255,0.3)',fontSize:'10px'}}>{item.label}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>

          <div style={{marginTop:'10px',fontSize:'11px',color:'rgba(255,255,255,0.25)',display:'flex',alignItems:'center',gap:'4px'}}>
            <Calendar size={11} />
            {new Date(biz.createdAt).toLocaleDateString('fa-IR')}
          </div>
        </div>
      ))}
    </div>
  )
}
