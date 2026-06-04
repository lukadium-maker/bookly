import { scheduleReminders } from '../reminder'
import { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { bot } from '../bot'

export async function appointmentRoutes(app: FastifyInstance) {

  app.post('/api/appointments', async (request, reply) => {
    const { businessId, serviceId, clientTelegramId, startTime, clientNote } = request.body as {
      businessId: string
      serviceId: string
      clientTelegramId: string
      startTime: string
      clientNote?: string
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, businessId }
    })
    if (!service) return reply.status(404).send({ error: 'سرویس یافت نشد' })

    // Find or create client
    let client = await prisma.user.findUnique({
      where: { telegramId: clientTelegramId }
    })
    if (!client) {
      client = await prisma.user.create({
        data: {
          telegramId: clientTelegramId,
          firstName: 'مشتری',
        }
      })
    }

    const start = new Date(startTime)
    const end = new Date(start.getTime() + service.duration * 60 * 1000)

    // Check conflict
    const conflict = await prisma.appointment.findFirst({
      where: {
        businessId,
        status: { in: ['confirmed', 'pending'] },
        AND: [
          { startTime: { lt: end } },
          { endTime: { gt: start } }
        ]
      }
    })
    if (conflict) return reply.status(409).send({ error: 'این زمان دیگر در دسترس نیست' })

    const appointment = await prisma.appointment.create({
      data: {
        businessId,
        serviceId,
        clientId: client.id,
        startTime: start,
        endTime: end,
        status: 'confirmed',
        clientNote
      },
      include: {
        service: true,
        business: { include: { owner: true } }
      }
    })

    const dateStr = start.toLocaleDateString('fa-IR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: appointment.business.timezone
    })
    const timeStr = start.toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: appointment.business.timezone
    })

    // Schedule reminders
    await scheduleReminders(appointment.id, start)

    // Notify owner
    try {
      await bot.api.sendMessage(
        appointment.business.owner.telegramId,
        `نوبت جدید ★

سرویس: ${appointment.service.name}
تاریخ: ${dateStr}
ساعت: ${timeStr}
مدت: ${appointment.service.duration} دقیقه`
      )
    } catch (err) {
      console.error('Failed to notify owner:', err)
    }

    // Notify client
    try {
      await bot.api.sendMessage(
        clientTelegramId,
        `✅ نوبت شما ثبت شد!\n\nکسب‌وکار: ${appointment.business.name}\nسرویس: ${appointment.service.name}\nتاریخ: ${dateStr}\nساعت: ${timeStr}`
      )
    } catch (err) {
      console.error('Failed to notify client:', err)
    }

    return appointment
  })


// Get client appointments
app.get('/api/appointments/my', async (request, reply) => {
  const { telegramId } = request.query as { telegramId: string }

  const user = await prisma.user.findUnique({ where: { telegramId } })

  const appointments = await prisma.appointment.findMany({
    where: {
      clientId: user.id,
      startTime: { gte: new Date() },
      status: 'confirmed'
    },
    include: {
      service: true,
      business: true
    },
    orderBy: { startTime: 'asc' }
  })

  return { appointments }
})

  app.get('/api/appointments/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { service: true, business: true, client: true }
    })
    if (!appointment) return reply.status(404).send({ error: 'نوبت یافت نشد' })
    return appointment
  })

  app.get('/api/appointments', async (request, reply) => {
    const { telegramId } = request.query as { telegramId: string }
    const user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return { appointments: [] }

    const appointments = await prisma.appointment.findMany({
      where: {
        clientId: user.id,
        status: { in: ['confirmed', 'pending'] },
        startTime: { gte: new Date() }
      },
      include: { service: true, business: true },
      orderBy: { startTime: 'asc' }
    })
    return { appointments }
  })

  app.patch('/api/appointments/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { cancelledBy } = request.body as { cancelledBy: string }
    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'cancelled', cancelledBy, cancelledAt: new Date() },
      include: { service: true, business: true, client: true }
    })

    try {
      const start = new Date(appointment.startTime)
      const tehran = new Date(start.getTime() + 210 * 60 * 1000)
      const timeStr = tehran.getUTCHours().toString().padStart(2,'0') + ':' + tehran.getUTCMinutes().toString().padStart(2,'0')
      const dateStr = start.toLocaleDateString('fa-IR', { month: 'long', day: 'numeric', timeZone: 'Asia/Tehran' })
      await bot.api.sendMessage(
        appointment.client.telegramId,
        'نوبت شما لغو شد\n\nکاربر گرامی، متاسفانه نوبت شما لغو گردید.\n\nکسب و کار: ' + appointment.business.name + '\nسرویس: ' + appointment.service.name + '\nتاریخ: ' + dateStr + '\nساعت: ' + timeStr + '\n\nبرای رزرو مجدد می توانید دوباره اقدام کنید.'
      )
    } catch (err) {
      console.error('Failed to notify client of cancellation:', err)
    }

    return appointment
  })

// Get client appointments


}
