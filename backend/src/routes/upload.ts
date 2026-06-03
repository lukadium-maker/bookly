import { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'

export async function uploadRoutes(app: FastifyInstance) {

  app.post('/api/owner/upload-avatar', async (request: any, reply) => {
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
        return reply.status(400).send({ error: 'Only JPEG PNG WebP allowed' })
      }

      const uploadDir = '/root/app/uploads/businesses'
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

      const oldFiles = fs.readdirSync(uploadDir).filter((f: string) => f.startsWith('business-' + business.id))
      oldFiles.forEach((f: string) => { try { fs.unlinkSync(path.join(uploadDir, f)) } catch {} })

      const chunks: Buffer[] = []
      for await (const chunk of data.file) chunks.push(chunk)
      const buffer = Buffer.concat(chunks)

      const filename = 'business-' + business.id + '.webp'
      const filepath = path.join(uploadDir, filename)

      await sharp(buffer)
        .resize(400, 400, { fit: 'cover', position: 'center' })
        .webp({ quality: 80 })
        .toFile(filepath)

      const avatarUrl = '/uploads/businesses/' + filename
      await (prisma.business as any).update({ where: { id: business.id }, data: { avatarUrl } })

      return { avatarUrl, message: 'OK' }
    } catch (err: any) {
      console.error('Upload error:', err)
      return reply.status(500).send({ error: err.message })
    }
  })

  app.post('/api/owner/upload-avatar-base64', async (request: any, reply) => {
    const { telegramId, base64, mimeType } = request.body as {
      telegramId: string
      base64: string
      mimeType: string
    }

    if (!telegramId) return reply.status(400).send({ error: 'telegramId required' })

    const user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const business = await prisma.business.findFirst({ where: { ownerId: user.id } })
    if (!business) return reply.status(404).send({ error: 'No business found' })

    try {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(mimeType)) {
        return reply.status(400).send({ error: 'Only JPEG PNG WebP allowed' })
      }

      const buffer = Buffer.from(base64, 'base64')

      if (buffer.length > 5 * 1024 * 1024) {
        return reply.status(400).send({ error: 'File too large' })
      }

      const uploadDir = '/root/app/uploads/businesses'
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

      const oldFiles = fs.readdirSync(uploadDir).filter((f: string) => f.startsWith('business-' + business.id))
      oldFiles.forEach((f: string) => { try { fs.unlinkSync(path.join(uploadDir, f)) } catch {} })

      const filename = 'business-' + business.id + '.webp'
      const filepath = path.join(uploadDir, filename)

      await sharp(buffer)
        .resize(400, 400, { fit: 'cover', position: 'center' })
        .webp({ quality: 80 })
        .toFile(filepath)

      const avatarUrl = '/uploads/businesses/' + filename
      await (prisma.business as any).update({ where: { id: business.id }, data: { avatarUrl } })

      console.log('Avatar uploaded via base64')
      return { avatarUrl, message: 'OK' }
    } catch (err: any) {
      console.error('Upload error:', err)
      return reply.status(500).send({ error: err.message })
    }
  })

  app.get('/api/owner/avatar', async (request, reply) => {
    const { telegramId, businessId } = request.query as { telegramId: string, businessId?: string }
    const user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })
    const business = await prisma.business.findFirst({
      where: businessId ? { id: businessId, ownerId: user.id } : { ownerId: user.id }
    })
    if (!business) return reply.status(404).send({ error: 'No business found' })
    return { avatarUrl: (business as any).avatarUrl || null }
  })
}
