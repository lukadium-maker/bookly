import { FastifyInstance } from 'fastify'
import { getAvailableSlots } from '../slots'

export async function slotRoutes(app: FastifyInstance) {

  // Get available slots for a business/service/date
  app.get('/api/businesses/:slug/slots', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const { serviceId, date } = request.query as { serviceId: string, date: string }

    if (!serviceId || !date) {
      return reply.status(400).send({ error: 'serviceId and date are required' })
    }

    const { prisma } = await import('../db')
    const business = await prisma.business.findUnique({ where: { slug } })

    if (!business) {
      return reply.status(404).send({ error: 'Business not found' })
    }

    const slots = await getAvailableSlots(business.id, serviceId, date)
    return { slots }
  })
}
