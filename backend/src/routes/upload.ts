import { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import path from 'path'
import fs from 'fs'
import { pipeline } from 'stream/promises'

export async function uploadRoutes(app: FastifyInstance) {

  // Upload avatar using raw multipart
  app.post('/api/owner/upload-avatar', {
    config: { rawBody: true }
  }, async (request: any, reply) => {

    const { telegramId } = request.query as { telegramId: string }
    if (!telegramId) return reply.status(400).send({ error: 'telegramId required' })

    const user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const business = await prisma.business.findFirst({ where: { ownerId: user.id } })
    if (!business) return reply.status(404).send({ error: 'No business found' })

    try {
      const data = await request.file()
      if (!data) return reply.status(400).send({ error: 'No file uploaded' })

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({ error: 'Only JPEG, PNG and WebP images allowed' })
      }

      const ext = data.mimetype === 'image/png' ? '.png' : data.mimetype === 'image/webp' ? '.webp' : '.jpg'
      const filename = 'business-' + business.id + ext
      const uploadDir = '/root/app/uploads/businesses'

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }

      // Delete old files
      const oldFiles = fs.readdirSync(uploadDir).filter((f: string) => f.startsWith('business-' + business.id))
      oldFiles.forEach((f: string) => {
        try { fs.unlinkSync(path.join(uploadDir, f)) } catch {}
      })

      const filepath = path.join(uploadDir, filename)
      await pipeline(data.file, fs.createWriteStream(filepath))

      const avatarUrl = '/uploads/businesses/' + filename
      await (prisma.business as any).update({ where: { id: business.id }, data: { avatarUrl } })

      return { avatarUrl, message: 'OK' }
    } catch (err: any) {
      console.error('Upload error:', err)
      return reply.status(500).send({ error: err.message })
    }
  })

  app.get('/api/owner/avatar', async (request, reply) => {
    const { telegramId } = request.query as { telegramId: string }
    const user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })
    const business = await prisma.business.findFirst({ where: { ownerId: user.id } })
    if (!business) return reply.status(404).send({ error: 'No business found' })
    return { avatarUrl: (business as any).avatarUrl || null }
  })
}
