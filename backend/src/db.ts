import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = 'postgresql://bookingapp:541541rooznavi@localhost:5432/bookingdb'
const adapter = new PrismaPg({ connectionString })

export const prisma = new PrismaClient({ adapter } as any)
