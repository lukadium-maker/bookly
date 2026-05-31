import { FastifyInstance } from 'fastify'
import { prisma } from '../db'

export async function businessRoutes(app: FastifyInstance) {

  // Get business by slug
  app.get('/api/businesses/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const business = await prisma.business.findUnique({
      where: { slug, isActive: true },
      include: {
        services: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' }
        }
      }
    })

    if (!business) {
      return reply.status(404).send({ error: 'Business not found' })
    }

    return business
  })
}
