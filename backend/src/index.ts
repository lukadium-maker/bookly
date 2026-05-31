import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import dotenv from 'dotenv'
import { businessRoutes } from './routes/businesses'
import { slotRoutes } from './routes/slots'
import { appointmentRoutes } from './routes/appointments'
import { ownerRoutes } from './routes/owner'
import { bot } from './bot'
import { processReminders } from './reminder'

dotenv.config()

const app = Fastify({ logger: true })

app.register(cors, { origin: '*' })
app.register(helmet, { contentSecurityPolicy: false })

app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try {
    done(null, JSON.parse(body as string))
  } catch (err) {
    done(err as Error, undefined)
  }
})

app.register(businessRoutes)
app.register(slotRoutes)
app.register(appointmentRoutes)
app.register(ownerRoutes)

app.post('/webhook/bot', async (request, reply) => {
  try {
    await bot.handleUpdate(request.body as any)
    return reply.status(200).send('ok')
  } catch (err) {
    console.error('Webhook error:', err)
    return reply.status(200).send('ok')
  }
})

app.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

const start = async () => {
  try {
    await bot.init()
    console.log('Bot initialized:', bot.botInfo.username)
    await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' })
    console.log('Server running on port 3000')
    await bot.api.setWebhook('https://bookly.kindtoy.ir/webhook/bot')
    console.log('Telegram webhook set successfully')

    setInterval(async () => {
      try { await processReminders() } catch (err) { console.error('Reminder error:', err) }
    }, 60 * 1000)
    console.log('Reminder worker started')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
