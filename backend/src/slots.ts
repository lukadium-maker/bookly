import { prisma } from './db'

interface TimeSlot {
  start: string
  end: string
  available: boolean
}

function toTehranMidnight(dateStr: string): Date {
  // dateStr is like "2026-06-10"
  // Tehran is UTC+3:30 = 210 minutes ahead
  const [year, month, day] = dateStr.split('-').map(Number)
  // Midnight in Tehran = UTC 20:30 previous day
  const utc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  // Subtract Tehran offset (3:30 = 210 min) to get UTC midnight of that Tehran day
  utc.setUTCMinutes(utc.getUTCMinutes() - 210)
  return utc
}

export async function getAvailableSlots(
  businessId: string,
  serviceId: string,
  date: string
): Promise<TimeSlot[]> {

  // Get business timezone offset (Asia/Tehran = +210 min)
  const business = await prisma.business.findUnique({ where: { id: businessId } })
  const tzOffset = 210 // Asia/Tehran = UTC+3:30

  // Parse date in Tehran timezone
  const [year, month, day] = date.split('-').map(Number)
  const tehranMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  tehranMidnight.setUTCMinutes(tehranMidnight.getUTCMinutes() - tzOffset)

  const dateStart = new Date(tehranMidnight)
  const dateEnd = new Date(tehranMidnight)
  dateEnd.setUTCHours(dateEnd.getUTCHours() + 24)

  // Day of week in Tehran
  const tehranDate = new Date(tehranMidnight.getTime() + tzOffset * 60 * 1000)
  const dayOfWeek = tehranDate.getUTCDay()

  // Get service
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId, isActive: true }
  })
  if (!service) return []

  // Get working hours for this day
  const workingHours = await prisma.workingHours.findFirst({
    where: { businessId, dayOfWeek, isActive: true }
  })
  if (!workingHours) return []

  // Check for special closure
  const closure = await prisma.specialClosure.findFirst({
    where: {
      businessId,
      date: { gte: dateStart, lte: dateEnd }
    }
  })
  if (closure) return []

  // Get existing appointments
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      businessId,
      startTime: { gte: dateStart, lt: dateEnd },
      status: { in: ['confirmed', 'pending'] }
    }
  })

  // Generate slots
  const slots: TimeSlot[] = []
  const [startHour, startMin] = workingHours.startTime.split(':').map(Number)
  const [endHour, endMin] = workingHours.endTime.split(':').map(Number)

  const workStart = startHour * 60 + startMin
  const workEnd = endHour * 60 + endMin
  const duration = service.duration
  const breakTime = (service as any).break_time || 0
  const totalBlock = duration + breakTime
  const slotInterval = Math.min(30, duration)
  const now = new Date()

  for (let time = workStart; time + totalBlock <= workEnd; time += slotInterval) {
    // Convert working time to UTC
    const slotStart = new Date(tehranMidnight)
    slotStart.setUTCMinutes(slotStart.getUTCMinutes() + time)

    const slotEnd = new Date(slotStart)
    slotEnd.setUTCMinutes(slotEnd.getUTCMinutes() + duration)

    // Skip past slots
    if (slotStart <= now) continue

    // Check overlap
    const isBooked = existingAppointments.some(apt => {
      return slotStart < apt.endTime && slotEnd > apt.startTime
    })

    if (!isBooked) {
      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        available: true
      })
    }
  }

  return slots
}
