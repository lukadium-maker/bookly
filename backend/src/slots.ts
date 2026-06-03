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

 const [year, month, day] = date.split('-').map(Number)
 const tehranMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
 tehranMidnight.setUTCMinutes(tehranMidnight.getUTCMinutes() - tzOffset)

 const dateStart = new Date(tehranMidnight)
 const dateEnd = new Date(tehranMidnight)
 dateEnd.setUTCHours(dateEnd.getUTCHours() + 24)

 const tehranDate = new Date(tehranMidnight.getTime() + tzOffset * 60 * 1000)
 const dayOfWeek = tehranDate.getUTCDay()

 const service = await prisma.service.findFirst({
   where: { id: serviceId, businessId, isActive: true }
 })
 if (!service) return []

 const workingHours = await prisma.workingHours.findFirst({
   where: { businessId, dayOfWeek, isActive: true }
 })
 if (!workingHours) return []

 const closure = await prisma.specialClosure.findFirst({
   where: { businessId, date: { gte: dateStart, lte: dateEnd } }
 })
 if (closure) return []

 const existingAppointments = await prisma.appointment.findMany({
   where: {
     businessId,
     startTime: { gte: dateStart, lt: dateEnd },
     status: { in: ['confirmed', 'pending'] }
   },
   orderBy: { startTime: 'asc' }
 })

 const blockedSlots = await (prisma as any).blockedSlot.findMany({
   where: { businessId, date }
 })
 const blockedTimes = new Set(blockedSlots.map((b: any) => b.slotTime))

 const duration = service.duration
 const breakTime = (service as any).break_time || 0
 const now = new Date()

 const [startHour, startMin] = workingHours.startTime.split(':').map(Number)
 const [endHour, endMin] = workingHours.endTime.split(':').map(Number)
 const workStart = startHour * 60 + startMin
 const workEnd = endHour * 60 + endMin

 // Build busy intervals: [start_minutes, end_minutes_including_break]
 const busyIntervals: { start: number, end: number, type: 'booked' | 'break' }[] = []

 for (const apt of existingAppointments) {
   const aptStartMin = (apt.startTime.getTime() - tehranMidnight.getTime()) / 60000
   const aptEndMin = aptStartMin + duration
   const aptBreakEnd = aptEndMin + breakTime

   busyIntervals.push({ start: aptStartMin, end: aptEndMin, type: 'booked' })
   if (breakTime > 0) {
     busyIntervals.push({ start: aptEndMin, end: aptBreakEnd, type: 'break' })
   }
 }

 const slots: TimeSlot[] = []

 // Generate slots every 30 minutes
 for (let time = workStart; time + duration <= workEnd; time += 30) {
   const slotStart = new Date(tehranMidnight)
   slotStart.setUTCMinutes(slotStart.getUTCMinutes() + time)

   const slotEnd = new Date(slotStart)
   slotEnd.setUTCMinutes(slotEnd.getUTCMinutes() + duration)

   // Skip past
   if (slotStart <= now) continue

   // Tehran time string for blocked check
   const tehranSlotStart = new Date(slotStart.getTime() + tzOffset * 60 * 1000)
   const slotTimeStr = tehranSlotStart.getUTCHours().toString().padStart(2,'0') + ':' + tehranSlotStart.getUTCMinutes().toString().padStart(2,'0')

   // Blocked manually
   if (blockedTimes.has(slotTimeStr)) {
     slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString(), status: 'blocked', available: false })
     continue
   }

   // Check against busy intervals
   const slotStartMin = time
   const slotEndMin = time + duration

   let status: SlotStatus = 'available'

   for (const busy of busyIntervals) {
     // Slot overlaps with busy interval
     if (slotStartMin < busy.end && slotEndMin > busy.start) {
       status = busy.type
       break
     }
     // Slot would push into a busy interval (need duration + breakTime free)
     if (slotStartMin >= busy.start && slotStartMin < busy.end) {
       status = busy.type
       break
     }
   }

   // Also check: does this slot's end+break overlap with next appointment?
   if (status === 'available') {
     const slotWithBreakEnd = slotEndMin + breakTime
     for (const apt of existingAppointments) {
       const aptStartMin = (apt.startTime.getTime() - tehranMidnight.getTime()) / 60000
       if (slotEndMin > aptStartMin && slotStartMin < aptStartMin) {
         status = 'booked'
         break
       }
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
