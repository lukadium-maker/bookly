import { useEffect, useState } from 'react'
import axios from 'axios'

const API = 'https://bookly.kindtoy.ir/api'

function toPersianNum(n: number) {
  return n.toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d)])
}

function formatDateTime(iso: string, _timezone: string) {
  const d = new Date(iso)
  // Manual Tehran conversion (UTC+3:30 = +210 min)
  const tehran = new Date(d.getTime() + 210 * 60 * 1000)
  const h = tehran.getUTCHours().toString().padStart(2,'0')
  const m = tehran.getUTCMinutes().toString().padStart(2,'0')
  const timeStr = h + ':' + m
  const dateStr = d.toLocaleDateString('fa-IR', {
    month: 'long', day: 'numeric', timeZone: 'Asia/Tehran'
  })
  return { dateStr, timeStr }
}

export default function MyAppointments({ telegramId }: { telegramId: string }) {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)


  const load = () => {
    setLoading(true)
    axios.get(API + '/appointments/my', { params: { telegramId } })
      .then(res => { setAppointments(res.data.appointments); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',color:'white',fontSize:'16px'}}>
      در حال بارگذاری...
    </div>
  )

  return (
    <div style={{background:'linear-gradient(160deg,#1A0003,#0D0001)',minHeight:'100vh',padding:'24px 16px',fontFamily:'Vazirmatn,sans-serif',direction:'rtl',color:'white'}}>
      <div style={{textAlign:'center',marginBottom:'32px',paddingTop:'16px'}}>
        <div style={{fontSize:'40px',marginBottom:'8px'}}>📅</div>
        <h1 style={{fontSize:'22px',fontWeight:'900',marginBottom:'4px'}}>نوبت‌های من</h1>
        <p style={{fontSize:'13px',color:'rgba(255,255,255,0.4)'}}>نوبت‌های آینده شما</p>
      </div>

      {appointments.length === 0 ? (
        <div style={{textAlign:'center',padding:'60px 24px'}}>
          <div style={{fontSize:'48px',marginBottom:'16px'}}>🗓️</div>
          <div style={{fontSize:'16px',color:'rgba(255,255,255,0.5)'}}>نوبت آینده‌ای ندارید</div>
        </div>
      ) : (
        appointments.map(apt => {
          const { dateStr, timeStr } = formatDateTime(apt.startTime, apt.business.timezone)
          return (
            <div key={apt.id} style={{
              background:'rgba(255,255,255,0.04)',
              border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:'20px',
              padding:'20px',
              marginBottom:'16px'
            }}>
              <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px'}}>
                {apt.business.avatarUrl ? (
                  <img src={'https://bookly.kindtoy.ir' + apt.business.avatarUrl}
                    style={{width:'48px',height:'48px',borderRadius:'12px',objectFit:'cover'}} alt="" />
                ) : (
                  <div style={{width:'48px',height:'48px',borderRadius:'12px',background:'rgba(99,51,255,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px'}}>🏢</div>
                )}
                <div>
                  <div style={{fontWeight:'800',fontSize:'16px'}}>{apt.business.name}</div>
                  <div style={{fontSize:'13px',color:'#C9A84C',fontWeight:'600'}}>{apt.service.name}</div>
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'16px'}}>
                <div style={{background:'rgba(255,255,255,0.04)',borderRadius:'12px',padding:'12px',textAlign:'center'}}>
                  <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>تاریخ</div>
                  <div style={{fontSize:'13px',fontWeight:'600'}}>{dateStr}</div>
                </div>
                <div style={{background:'rgba(255,255,255,0.04)',borderRadius:'12px',padding:'12px',textAlign:'center'}}>
                  <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>ساعت</div>
                  <div style={{fontSize:'18px',fontWeight:'800',color:'#C9A84C'}}>{timeStr}</div>
                </div>
              </div>

              <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px',color:'rgba(255,255,255,0.4)',marginBottom:'16px'}}>
                <span>مدت: {toPersianNum(apt.service.duration)} دقیقه</span>
                <span>قیمت: {apt.service.price === 0 ? 'رایگان' : toPersianNum(apt.service.price) + ' تومان'}</span>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
