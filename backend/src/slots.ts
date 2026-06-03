import { prisma } from './db'

type SlotStatus = 'available' | 'booked' | 'break' | 'blocked' | 'past'

interface TimeSlot {
  start: string
  end: string
  status: SlotStatus
  available: boolean
}

export async function getAvailableSlots(
  businessId: string,
  serviceId: string,
  date: string
): Promise<TimeSlot[]> {

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

  // Get working hours
  const workingHours = await prisma.workingHours.findFirst({
    where: { businessId, dayOfWeek, isActive: true }
  })
  if (!workingHours) return []

  // Check special closure
  const closure = await prisma.specialClosure.findFirst({
    where: { businessId, date: { gte: dateStart, lte: dateEnd } }
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

  // Get blocked slots
  const blockedSlots = await (prisma as any).blockedSlot.findMany({
    where: { businessId, date }
  })
  const blockedTimes = new Set(blockedSlots.map((b: any) => b.slotTime))

  // Build busy timeline: each appointment occupies [start, end + breakTime]
  const duration = service.duration
  const breakTime = (service as any).break_time || 0
  const now = new Date()

  // Working hours in minutes
  const [startHour, startMin] = workingHours.startTime.split(':').map(Number)
  const [endHour, endMin] = workingHours.endTime.split(':').map(Number)
  const workStart = startHour * 60 + startMin
  const workEnd = endHour * 60 + endMin

  const slots: TimeSlot[] = []

  // Generate every 30-min slot within working hours
  for (let time = workStart; time + duration <= workEnd; time += 30) {

    const slotStart = new Date(tehranMidnight)
    slotStart.setUTCMinutes(slotStart.getUTCMinutes() + time)

    const slotEnd = new Date(slotStart)
    slotEnd.setUTCMinutes(slotEnd.getUTCMinutes() + duration)

    const slotEndWithBreak = new Date(slotEnd)
    slotEndWithBreak.setUTCMinutes(slotEndWithBreak.getUTCMinutes() + breakTime)

    // Past slots
    if (slotStart <= now) {
      continue // dont show past slots
    }

    // Tehran time string for blocked check
    const tehranSlotStart = new Date(slotStart.getTime() + tzOffset * 60 * 1000)
    const slotTimeStr = tehranSlotStart.getUTCHours().toString().padStart(2,'0') + ':' + tehranSlotStart.getUTCMinutes().toString().padStart(2,'0')

    // Blocked manually
    if (blockedTimes.has(slotTimeStr)) {
      slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString(), status: 'blocked', available: false })
      continue
    }

    // Check against existing appointments
    let status: SlotStatus = 'available'

    for (const apt of existingAppointments) {
      const aptStart = apt.startTime
      const aptEnd = apt.endTime
      const aptEndWithBreak = new Date(aptEnd)
      aptEndWithBreak.setUTCMinutes(aptEndWithBreak.getUTCMinutes() + breakTime)

      // Slot overlaps with appointment itself
      if (slotStart < aptEnd && slotEnd > aptStart) {
        status = 'booked'
        break
      }

      // Slot falls in break time after appointment
      if (slotStart >= aptEnd && slotStart < aptEndWithBreak) {
        status = 'break'
        break
      }

      // Slot would overlap with appointment's break time
      if (slotStart < aptEndWithBreak && slotEnd > aptStart) {
        status = 'booked'
        break
      }
    }

    slots.push({
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
      status,
      available: status === 'available'
    })
  }

  return slots
}
