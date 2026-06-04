import { FastifyInstance } from 'fastify'
import { prisma } from '../db'

export async function blockedSlotRoutes(app: FastifyInstance) {

  // Get blocked slots for a date
  app.get('/api/owner/blocked-slots', async (request, reply) => {
    const { telegramId, date, businessId: bizId } = request.query as { telegramId: string, date: string, businessId?: string }

    const user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const business = await prisma.business.findFirst({ where: bizId ? { id: bizId, ownerId: user.id } : { ownerId: user.id } })
    if (!business) return reply.status(404).send({ error: 'No business found' })

    const blocked = await (prisma as any).blockedSlot.findMany({
      where: { businessId: business.id, date }
    })

    // Get booked slots for this date
    const tzOffset = 210
    const [year, month, day] = date.split('-').map(Number)
    const tehranMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
    tehranMidnight.setUTCMinutes(tehranMidnight.getUTCMinutes() - tzOffset)
    const dateEnd = new Date(tehranMidnight)
    dateEnd.setUTCHours(dateEnd.getUTCHours() + 24)

    const appointments = await prisma.appointment.findMany({
      where: {
        businessId: business.id,
        startTime: { gte: tehranMidnight, lt: dateEnd },
        status: { in: ['confirmed', 'pending'] }
      }
    })

    // Generate all 30-min slots that overlap with appointments
    const booked: string[] = []
    for (const apt of appointments) {
      const aptStartMin = Math.round((apt.startTime.getTime() - tehranMidnight.getTime()) / 60000)
      const aptEndMin = Math.round((apt.endTime.getTime() - tehranMidnight.getTime()) / 60000)
      // Mark all 30-min slots that overlap
      for (let t = Math.floor(aptStartMin / 30) * 30; t < aptEndMin; t += 30) {
        const h = Math.floor(t / 60).toString().padStart(2,'0')
        const m = (t % 60).toString().padStart(2,'0')
        const slotStr = h + ':' + m
        if (!booked.includes(slotStr)) booked.push(slotStr)
      }
    }

    return { 
      blocked: blocked.map((b: any) => b.slotTime),
      booked
    }
  })

  // Toggle blocked slot
  app.post('/api/owner/blocked-slots', async (request, reply) => {
    const { telegramId, date, slotTime, businessId: bizId } = request.body as {
      telegramId: string, date: string, slotTime: string, businessId?: string
    }

    const user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const business = await prisma.business.findFirst({
      where: bizId ? { id: bizId, ownerId: user.id } : { ownerId: user.id }
    })
    if (!business) return reply.status(404).send({ error: 'No business found' })

    // Check if slot is already blocked
    const existing = await (prisma as any).blockedSlot.findFirst({
      where: { businessId: business.id, date, slotTime }
    })

    if (existing) {
      // Unblock
      await (prisma as any).blockedSlot.delete({ where: { id: existing.id } })
      return { blocked: false, slotTime }
    } else {
      // Check if there's an appointment at this time
      const slotStart = new Date(date + 'T' + slotTime + ':00.000Z')
      // Adjust for Tehran timezone (UTC+3:30)
      slotStart.setMinutes(slotStart.getMinutes() - 210)
      const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000)

      const conflict = await prisma.appointment.findFirst({
        where: {
          businessId: business.id,
          status: 'confirmed',
          startTime: { lt: slotEnd },
          endTime: { gt: slotStart }
        }
      })

      if (conflict) {
        return reply.status(409).send({ error: '\u0627\u06cc\u0646 \u0633\u0627\u0639\u062a \u0646\u0648\u0628\u062a \u062f\u0627\u0631\u062f \u0648 \u0642\u0627\u0628\u0644 \u0628\u0633\u062a\u0646 \u0646\u06cc\u0633\u062a' })
      }

      // Block
      await (prisma as any).blockedSlot.create({
        data: { businessId: business.id, date, slotTime }
      })
      return { blocked: true, slotTime }
    }
  })
}
