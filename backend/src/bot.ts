import { Bot } from 'grammy'
import { prisma } from './db'

const BOT_TOKEN = '8837076290:AAF266pt1EQpksIQBcse89yAINC3G14YBqU'

export const bot = new Bot(BOT_TOKEN)

bot.command('admin', async (ctx) => {
  const telegramId = ctx.from?.id?.toString()
  if (telegramId !== '24247682') return

  await ctx.reply('پنل مدیریت بوکلی', {
    reply_markup: {
      inline_keyboard: [[{
        text: 'ورود به پنل',
        web_app: { url: 'https://bookly.kindtoy.ir/app?admin=1&v=85' }
      }]]
    }
  })
})

bot.command('mynobat', async (ctx) => {
  await ctx.reply('نوبت‌های شما', {
    reply_markup: {
      inline_keyboard: [[{
        text: 'مشاهده نوبت‌های من',
        web_app: { url: 'https://bookly.kindtoy.ir/app?mode=myappointments&v=85' }
      }]]
    }
  })
})

bot.command('start', async (ctx) => {
  const user = ctx.from
  if (!user) return

  // Save or update user
  await prisma.user.upsert({
    where: { telegramId: String(user.id) },
    update: { firstName: user.first_name, username: user.username },
    create: {
      telegramId: String(user.id),
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username
    }
  })

  const startParam = ctx.match

  if (startParam) {
    // Client opening a business booking page
    await ctx.reply('\u0628\u0647 \u0628\u0648\u06a9\u0644\u06cc \u062e\u0648\u0634 \u0622\u0645\u062f\u06cc\u062f!', {
      reply_markup: {
        inline_keyboard: [[{
          text: '\ud83d\udcc5 \u0631\u0632\u0631\u0648 \u0646\u0648\u0628\u062a',
          web_app: { url: 'https://bookly.kindtoy.ir/app?business=' + startParam + '&v=36' }
        }]]
      }
    })
  } else {
    // Check if user has a business
    const dbUser = await prisma.user.findUnique({ where: { telegramId: String(user.id) } })
    const business = dbUser ? await prisma.business.findFirst({ where: { ownerId: dbUser.id } }) : null

    if (business) {
      // Show owner panel with their business
      await ctx.reply('\u062e\u0648\u0634 \u0622\u0645\u062f\u06cc\u062f \u0628\u0647 \u0628\u0648\u06a9\u0644\u06cc! \ud83d\udc4b', {
        reply_markup: {
          inline_keyboard: [
            [{
              text: '\ud83d\udcc5 \u0631\u0632\u0631\u0648 \u0646\u0648\u0628\u062a',
              web_app: { url: 'https://bookly.kindtoy.ir/app?business=' + business.slug + '&v=36' }
            }],
            [{
              text: '\ud83c\udfe2 \u067e\u0646\u0644 \u0645\u062f\u06cc\u0631\u06cc\u062a',
              web_app: { url: 'https://bookly.kindtoy.ir/app?mode=owner&v=36' }
            }]
          ]
        }
      })
    } else {
      // New user - show onboarding
      await ctx.reply('\u0628\u0647 \u0628\u0648\u06a9\u0644\u06cc \u062e\u0648\u0634 \u0622\u0645\u062f\u06cc\u062f! \ud83d\udc4b\n\u0628\u0631\u0627\u06cc \u0634\u0631\u0648\u0639 \u06a9\u0633\u0628\u200c\u0648\u06a9\u0627\u0631 \u062e\u0648\u062f \u0631\u0627 \u062b\u0628\u062a \u06a9\u0646\u06cc\u062f', {
        reply_markup: {
          inline_keyboard: [[{
            text: '\ud83c\udfe2 \u062b\u0628\u062a \u06a9\u0633\u0628\u200c\u0648\u06a9\u0627\u0631',
            web_app: { url: 'https://bookly.kindtoy.ir/app?mode=owner&v=36' }
          }]]
        }
      })
    }
  }
})

bot.command('mybookings', async (ctx) => {
  await ctx.reply('\u0646\u0648\u0628\u062a\u200c\u0647\u0627\u06cc \u0634\u0645\u0627 \u062f\u0631 \u062d\u0627\u0644 \u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc...')
})
