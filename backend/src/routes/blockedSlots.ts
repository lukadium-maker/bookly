import { FastifyInstance } from 'fastify'
import { prisma } from '../db'

export async function blockedSlotRoutes(app: FastifyInstance) {

  // Get blocked slots for a date
  app.get('/api/owner/blocked-slots', async (request, reply) => {
    const { telegramId, date } = request.query as { telegramId: string, date: string }

    const user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const business = await prisma.business.findFirst({ where: { ownerId: user.id } })
    if (!business) return reply.status(404).send({ error: 'No business found' })

    const blocked = await (prisma as any).blockedSlot.findMany({
      where: { businessId: business.id, date }
    })

    return { blocked: blocked.map((b: any) => b.slotTime) }
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
