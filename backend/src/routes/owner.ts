import { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { bot } from '../bot'

export async function ownerRoutes(app: FastifyInstance) {


 app.get('/api/owner/businesses', async (request, reply) => {
   const { telegramId } = request.query as { telegramId: string }
   const user = await prisma.user.findUnique({ where: { telegramId } })
   if (!user) return reply.status(404).send({ error: 'User not found' })
   const businesses = await prisma.business.findMany({
     where: { ownerId: user.id },
     include: { services: { where: { isActive: true } } },
     orderBy: { createdAt: 'asc' }
   })
   return { businesses }
 })

  app.get('/api/owner/business', async (request, reply) => {
    const { telegramId, businessId } = request.query as { telegramId: string, businessId?: string }
    const user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const business = await prisma.business.findFirst({
      where: businessId ? { id: businessId, ownerId: user.id } : { ownerId: user.id },
      include: {
        services: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } },
        workingHours: { orderBy: { dayOfWeek: 'asc' } }
      }
    })
    if (!business) return reply.status(404).send({ error: 'No business found' })
    return business
  })

  app.post('/api/owner/business', async (request, reply) => {
    const { telegramId, name, description, category, timezone } = request.body as {
      telegramId: string
      name: string
      description?: string
      category?: string
      timezone?: string
    }

    let user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const timestamp = Date.now().toString(36)
    let baseSlug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 20)

    if (!baseSlug || baseSlug.replace(/-/g, '').length < 2) {
      baseSlug = 'business'
    }

    let slug = baseSlug + '-' + timestamp
    let counter = 1
    while (await prisma.business.findUnique({ where: { slug } })) {
      slug = baseSlug + '-' + timestamp + '-' + counter++
    }

    const business = await prisma.business.create({
      data: {
        name, description, category, slug,
        timezone: timezone || 'Asia/Tehran',
        ownerId: user.id
      }
    })
    return business
  })

  app.get('/api/owner/appointments', async (request, reply) => {
    const { telegramId, filter, businessId } = request.query as { telegramId: string, filter?: string, businessId?: string }
    const user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const business = await prisma.business.findFirst({ where: businessId ? { id: businessId, ownerId: user.id } : { ownerId: user.id } })
    if (!business) return reply.status(404).send({ error: 'No business found' })

    const now = new Date()
    let where: any = { businessId: business.id }

    if (filter === 'today') {
      const start = new Date(now); start.setHours(0,0,0,0)
      const end = new Date(now); end.setHours(23,59,59,999)
      where.startTime = { gte: start, lte: end }
      where.status = 'confirmed'
    } else if (filter === 'upcoming') {
      where.startTime = { gte: now }
      where.status = 'confirmed'
    } else {
      where.startTime = { gte: now }
      where.status = { in: ['confirmed', 'pending'] }
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: { service: true, client: true },
      orderBy: { startTime: 'asc' },
      take: 50
    })

    return { appointments, businessId: business.id, slug: business.slug }
  })

  app.patch('/api/owner/appointments/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { telegramId } = request.body as { telegramId: string }

    const user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const business = await prisma.business.findFirst({ where: { ownerId: user.id } })
    if (!business) return reply.status(404).send({ error: 'No business found' })

    const appointment = await prisma.appointment.findFirst({
      where: { id, businessId: business.id },
      include: { service: true, client: true, business: true }
    })
    if (!appointment) return reply.status(404).send({ error: 'Appointment not found' })

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: 'cancelled', cancelledBy: telegramId, cancelledAt: new Date() }
    })

    // Notify client
    const dateStr = appointment.startTime.toLocaleDateString('fa-IR', {
      weekday: 'long', month: 'long', day: 'numeric',
      timeZone: appointment.business.timezone
    })
    const timeStr = appointment.startTime.toLocaleTimeString('fa-IR', {
      hour: '2-digit', minute: '2-digit',
      timeZone: appointment.business.timezone
    })

    try {
      await bot.api.sendMessage(
        appointment.client.telegramId,
        `❌ نوبت لغو شد\n\n` +
        `متاسفانه نوبت شما توسط کسب‌وکار لغو شد.\n\n` +
        `کسب‌وکار: ${appointment.business.name}\n` +
        `سرویس: ${appointment.service.name}\n` +
        `تاریخ: ${dateStr}\n` +
        `ساعت: ${timeStr}\n\n` +
        `برای رزرو مجدد با کسب‌وکار تماس بگیرید.`
      )
    } catch (err) {
      console.error('Failed to notify client about cancellation:', err)
    }

    return updated
  })

  app.put('/api/owner/working-hours', async (request, reply) => {
    const { telegramId, hours } = request.body as {
      telegramId: string
      hours: Array<{ dayOfWeek: number, startTime: string, endTime: string, isActive: boolean }>
    }
    const user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const business = await prisma.business.findFirst({ where: { ownerId: user.id } })
    if (!business) return reply.status(404).send({ error: 'No business found' })

    for (const hour of hours) {
      await prisma.workingHours.upsert({
        where: { businessId_dayOfWeek: { businessId: business.id, dayOfWeek: hour.dayOfWeek } },
        update: { startTime: hour.startTime, endTime: hour.endTime, isActive: hour.isActive },
        create: { businessId: business.id, ...hour }
      })
    }
    return { success: true }
  })

  app.post('/api/owner/services', async (request, reply) => {
    const { telegramId, name, duration, price, breakTime } = request.body as {
      telegramId: string, name: string, duration: number, price: number, breakTime?: number
    }
    const user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const business = await prisma.business.findFirst({ where: { ownerId: user.id } })
    if (!business) return reply.status(404).send({ error: 'No business found' })

    const service = await prisma.service.create({
      data: { businessId: business.id, name, duration, price, break_time: breakTime || 0 } as any
    })
    return service
  })

  // Edit business info
  app.patch('/api/owner/business', async (request, reply) => {
    const { telegramId, name, description, category } = request.body as {
      telegramId: string
      name?: string
      description?: string
      category?: string
    }

    const user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const business = await prisma.business.findFirst({ where: { ownerId: user.id } })
    if (!business) return reply.status(404).send({ error: 'No business found' })

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
      }
    })

    return { success: true, business: updated }
  })

  // Delete business
  app.delete('/api/owner/business', async (request, reply) => {
    const { telegramId, businessId } = request.body as { telegramId: string, businessId?: string }

    const user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const business = await prisma.business.findFirst({ where: businessId ? { id: businessId, ownerId: user.id } : { ownerId: user.id } })
    if (!business) return reply.status(404).send({ error: 'No business found' })

    // Check no active appointments
    const activeApts = await prisma.appointment.count({
      where: {
        businessId: business.id,
        status: 'confirmed',
        startTime: { gte: new Date() }
      }
    })

    if (activeApts > 0) {
      return reply.status(400).send({
        error: 'ابتدا باید ' + activeApts + ' نوبت آینده را لغو کنید'
      })
    }

    // Delete in order: reminders → appointments → working hours → closures → services → business
    const appointments = await prisma.appointment.findMany({ where: { businessId: business.id } })
    for (const apt of appointments) {
      await prisma.reminder.deleteMany({ where: { appointmentId: apt.id } })
    }
    await prisma.appointment.deleteMany({ where: { businessId: business.id } })
    await prisma.workingHours.deleteMany({ where: { businessId: business.id } })
    await prisma.specialClosure.deleteMany({ where: { businessId: business.id } })
    await prisma.service.deleteMany({ where: { businessId: business.id } })
    await prisma.business.delete({ where: { id: business.id } })

    return { success: true, message: 'کسب‌وکار با موفقیت حذف شد' }
  })

  app.delete('/api/owner/services/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { telegramId } = request.body as { telegramId: string }
    const user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    await prisma.service.update({ where: { id }, data: { isActive: false } })
    return { success: true }
  })
}
