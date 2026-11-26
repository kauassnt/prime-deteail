import { Appointment } from '../types';

export const BUSINESS_OPEN_TIME = '09:00';
export const BUSINESS_CLOSE_TIME = '17:00';
export const BUSINESS_OPEN_MINUTES = 9 * 60; // 09:00 -> 540
export const BUSINESS_CLOSE_MINUTES = 17 * 60; // 17:00 -> 1020
export const DEFAULT_WASH_DURATION_MINUTES = 60; // 1h00 por atendimento

/** Grade padrão em blocos de 1h00 dentro do expediente 09:00 às 17:00 */
export const DEFAULT_APPOINTMENT_SLOTS: string[] = [
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
];

/** Opções válidas para configuração administrativa (horários de início cuja lavagem de 1h termina até 17:00) */
export const PRESET_ONE_HOUR_CANDIDATE_SLOTS: string[] = [
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
];

export function timeToMinutes(hhmm: string): number {
  const [hStr, mStr] = (hhmm || '').split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const safe = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(safe / 60) % 24;
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatSlotRange(
  startTime: string,
  durationMinutes: number = DEFAULT_WASH_DURATION_MINUTES
): string {
  const start = timeToMinutes(startTime);
  if (start < 0) return startTime;
  const effectiveDuration = Math.max(DEFAULT_WASH_DURATION_MINUTES, durationMinutes);
  return `${startTime} às ${minutesToTime(start + effectiveDuration)}`;
}

export function isSlotWithinBusinessHours(
  startTime: string,
  durationMinutes: number = DEFAULT_WASH_DURATION_MINUTES
): boolean {
  const start = timeToMinutes(startTime);
  if (start < 0) return false;
  const blockDuration = Math.max(DEFAULT_WASH_DURATION_MINUTES, durationMinutes);
  const end = start + blockDuration;
  return start >= BUSINESS_OPEN_MINUTES && end <= BUSINESS_CLOSE_MINUTES;
}

/**
 * Verifica se já existe agendamento ativo (não cancelado) que colide com o intervalo solicitado.
 * Garante agendamento único por horário por cliente.
 */
export function findConflictingAppointment(
  appointments: Appointment[],
  date: string,
  startTime: string,
  durationMinutes: number = DEFAULT_WASH_DURATION_MINUTES,
  excludeAppointmentId?: string
): Appointment | null {
  const startMins = timeToMinutes(startTime);
  if (startMins < 0) return null;
  const blockDuration = Math.max(DEFAULT_WASH_DURATION_MINUTES, durationMinutes);
  const endMins = startMins + blockDuration;

  const sameDayActive = appointments.filter(
    a =>
      a.date === date &&
      a.status !== 'cancelado' &&
      (!excludeAppointmentId || a.id !== excludeAppointmentId)
  );

  for (const apt of sameDayActive) {
    const aStart = timeToMinutes(apt.startTime);
    if (aStart < 0) continue;
    const parsedEnd = apt.endTime ? timeToMinutes(apt.endTime) : -1;
    const inferredDuration = parsedEnd > aStart ? parsedEnd - aStart : 0;
    const aptBlock = Math.max(
      DEFAULT_WASH_DURATION_MINUTES,
      apt.durationMinutes || 0,
      inferredDuration
    );
    const aEnd = aStart + aptBlock;

    if (startMins < aEnd && endMins > aStart) {
      return apt;
    }
  }
  return null;
}

/**
 * Retorna exclusivamente os horários disponíveis (livres de conflito e dentro de 09:00–17:00).
 * Horários já agendados não são retornados para que desapareçam da escolha.
 */
export function getAvailableSlotsForDate(
  configuredSlots: string[],
  appointments: Appointment[],
  date: string,
  durationMinutes: number = DEFAULT_WASH_DURATION_MINUTES,
  excludeAppointmentId?: string
): string[] {
  const blockDuration = Math.max(DEFAULT_WASH_DURATION_MINUTES, durationMinutes);
  const sourceSlots =
    configuredSlots && configuredSlots.length > 0
      ? configuredSlots
      : DEFAULT_APPOINTMENT_SLOTS;

  const normalized = Array.from(new Set(sourceSlots))
    .filter(slot => isSlotWithinBusinessHours(slot, blockDuration))
    .sort((a, b) => a.localeCompare(b));

  const fallbackIfConfigEmpty =
    normalized.length > 0
      ? normalized
      : DEFAULT_APPOINTMENT_SLOTS.filter(slot => isSlotWithinBusinessHours(slot, blockDuration));

  return fallbackIfConfigEmpty.filter(
    slot => !findConflictingAppointment(appointments, date, slot, blockDuration, excludeAppointmentId)
  );
}
