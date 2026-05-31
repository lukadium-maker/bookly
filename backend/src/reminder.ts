import { prisma } from './db'
import { bot } from './bot'

export async function scheduleReminders(appointmentId: string, startTime: Date) {
  const reminder24h = new Date(startTime.getTime() - 24 * 60 * 60 * 1000)
  const reminder2h = new Date(startTime.getTime() - 2 * 60 * 60 * 1000)
  const now = new Date()

  if (reminder24h > now) {
    await prisma.reminder.create({
      data: { appointmentId, type: '24h', scheduledFor: reminder24h, status: 'pending' }
    })
  }

  if (reminder2h > now) {
    await prisma.reminder.create({
      data: { appointmentId, type: '2h', scheduledFor: reminder2h, status: 'pending' }
    })
  }
}

export async function processReminders() {
  const now = new Date()

  const dueReminders = await prisma.reminder.findMany({
    where: { status: 'pending', scheduledFor: { lte: now } },
    include: {
      appointment: {
        include: { service: true, business: true, client: true }
      }
    }
  })

  for (const reminder of dueReminders) {
    const apt = reminder.appointment

    if (apt.status !== 'confirmed') {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: 'cancelled' } })
      continue
    }

    const timeLabel = reminder.type === '24h' ? '24 ساعت' : '2 ساعت'

    const dateStr = apt.startTime.toLocaleDateString('fa-IR', {
      weekday: 'long', month: 'long', day: 'numeric',
      timeZone: apt.business.timezone
    })
    const timeStr = apt.startTime.toLocaleTimeString('fa-IR', {
      hour: '2-digit', minute: '2-digit',
      timeZone: apt.business.timezone
    })

    try {
      await bot.api.sendMessage(
        apt.client.telegramId,
        '⏰ یادآوری نوبت\n\n' +
        timeLabel + ' دیگر نوبت شما شروع می‌شود.\n\n' +
        'کسب‌وکار: ' + apt.business.name + '\n' +
        'سرویس: ' + apt.service.name + '\n' +
        'تاریخ: ' + dateStr + '\n' +
        'ساعت: ' + timeStr
      )

      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'sent', sentAt: now }
      })

      console.log('Reminder sent for appointment:', apt.id)
    } catch (err) {
      console.error('Failed to send reminder:', err)
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'failed' }
      })
    }
  }
}
