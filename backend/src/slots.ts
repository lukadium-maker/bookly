import { prisma } from './db'

interface TimeSlot {
  start: string
  end: string
  available: boolean
}

export async function getAvailableSlots(
  businessId: string,
  serviceId: string,
  date: string
): Promise<TimeSlot[]> {

  // Parse the requested date
  const requestedDate = new Date(date)
  const dayOfWeek = requestedDate.getDay()

  // Get service duration
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId, isActive: true }
  })
  if (!service) return []

  // Get working hours for this day
  const workingHours = await prisma.workingHours.findFirst({
    where: { businessId, dayOfWeek, isActive: true }
  })
  if (!workingHours) return []

  // Check for special closure on this date
  const dateStart = new Date(date)
  dateStart.setUTCHours(0, 0, 0, 0)
  const dateEnd = new Date(date)
  dateEnd.setUTCHours(23, 59, 59, 999)

  const closure = await prisma.specialClosure.findFirst({
    where: {
      businessId,
      date: { gte: dateStart, lte: dateEnd }
    }
  })
  if (closure) return []

  // Get existing appointments for this date
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      businessId,
      startTime: { gte: dateStart, lte: dateEnd },
      status: { in: ['confirmed', 'pending'] }
    }
  })

  // Generate all possible slots
  const slots: TimeSlot[] = []
  const [startHour, startMin] = workingHours.startTime.split(':').map(Number)
  const [endHour, endMin] = workingHours.endTime.split(':').map(Number)

  const workStart = startHour * 60 + startMin
  const workEnd = endHour * 60 + endMin
  const duration = service.duration
  const now = new Date()

  const slotInterval = Math.min(30, duration)
  for (let time = workStart; time + duration <= workEnd; time += slotInterval) {
    const slotStart = new Date(date)
    slotStart.setUTCHours(0, 0, 0, 0)
    slotStart.setUTCMinutes(slotStart.getUTCMinutes() + time)

    const slotEnd = new Date(slotStart)
    slotEnd.setUTCMinutes(slotEnd.getUTCMinutes() + duration)

    // Skip slots in the past
    if (slotStart <= now) continue

    // Check if slot overlaps with existing appointment
    const isBooked = existingAppointments.some(apt => {
      return slotStart < apt.endTime && slotEnd > apt.startTime
    })

    slots.push({
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
      available: !isBooked
    })
  }

  return slots.filter(s => s.available)
}
