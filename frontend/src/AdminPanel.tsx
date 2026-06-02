import { useEffect, useState } from 'react'
import axios from 'axios'

const API = 'https://bookly.kindtoy.ir/api'

// Add font
const style = document.createElement('link')
style.rel = 'stylesheet'
style.href = 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap'
document.head.appendChild(style)

export default function AdminPanel({ telegramId }: { telegramId: string }) {
  const [businesses, setBusinesses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    console.log('Admin telegramId:', telegramId)
    axios.get(API + '/admin/businesses', { params: { telegramId } })
      .then(res => { setBusinesses(res.data.businesses); setLoading(false) })
      .catch((err) => { setError('خطا: ' + (err.response?.data?.error || err.message)); setLoading(false) })
  }, [])

  if (loading) return <div style={{color:'white',textAlign:'center',padding:'40px'}}>در حال بارگذاری...</div>
  if (error) return <div style={{color:'red',textAlign:'center',padding:'40px'}}>{error}</div>

  return (
    <div style={{background:'#1A0003',minHeight:'100vh',padding:'24px',fontFamily:'Vazirmatn,sans-serif',direction:'rtl',color:'white'}}>
      <h1 style={{fontSize:'24px',fontWeight:'900',color:'#C9A84C',marginBottom:'8px'}}>پنل ادمین بوکلی</h1>
      <p style={{color:'rgba(255,255,255,0.4)',marginBottom:'24px',fontSize:'13px'}}>{businesses.length} کسب‌وکار ثبت شده</p>

      {businesses.map(biz => (
        <div key={biz.id} style={{
          background:'rgba(255,255,255,0.04)',
          border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:'16px',
          padding:'16px',
          marginBottom:'12px'
        }}>
          <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'8px'}}>
            {biz.avatarUrl && (
              <img src={'https://bookly.kindtoy.ir' + biz.avatarUrl} style={{width:'40px',height:'40px',borderRadius:'10px',objectFit:'cover'}} alt="" />
            )}
            <div>
              <div style={{fontWeight:'700',fontSize:'16px'}}>{biz.name}</div>
              <div style={{fontSize:'12px',color:'#C9A84C'}}>{biz.slug}</div>
            </div>
          </div>
          <div style={{display:'flex',gap:'16px',fontSize:'13px',color:'rgba(255,255,255,0.5)'}}>
            <span>👤 {biz.owner?.firstName || '-'}</span>
            <span>{biz.services?.length || 0} سرویس</span>
            <span>📅 {biz._count?.appointments || 0} نوبت</span>
            <span>📁 {biz.category || '-'}</span>
          </div>
          <div style={{marginTop:'8px',fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>
            {new Date(biz.createdAt).toLocaleDateString('fa-IR')}
          </div>
        </div>
      ))}
    </div>
  )
}
