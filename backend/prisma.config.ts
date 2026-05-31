import path from 'node:path'
import { defineConfig } from 'prisma/config'
import { PrismaPg } from '@prisma/adapter-pg'

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  datasource: {
    url: 'postgresql://bookingapp:541541rooznavi@localhost:5432/bookingdb',
  },
  migrate: {
    async adapter() {
      return new PrismaPg({
        connectionString: 'postgresql://bookingapp:541541rooznavi@localhost:5432/bookingdb',
      })
    },
  },
})
