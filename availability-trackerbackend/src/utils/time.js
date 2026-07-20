/**
 * All stored times are UTC. Use these helpers for validation and conversion.
 */

export function nowUTC() {
  return new Date();
}

export function startOfDayUTC(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function isPast(date) {
  return new Date(date) <= nowUTC();
}

export function isPastDateOnly(dateStrOrDate) {
  const d = typeof dateStrOrDate === "string" ? new Date(dateStrOrDate + "T00:00:00Z") : startOfDayUTC(dateStrOrDate);
  return d < startOfDayUTC(nowUTC());
}

export function isPastTime(dateTime) {
  return new Date(dateTime) <= nowUTC();
}

/** Parse "YYYY-MM-DD" as UTC midnight */
export function parseDateUTC(dateStr) {
  return new Date(dateStr + "T00:00:00.000Z");
}

/** Ensure slot is 1-hour and on the hour (e.g. 14:00–15:00 UTC) */
export function normalizeSlot(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  start.setUTCMinutes(0, 0, 0);
  end.setUTCMinutes(0, 0, 0);
  const oneHour = 60 * 60 * 1000;
  if (end.getTime() - start.getTime() !== oneHour) {
    end.setTime(start.getTime() + oneHour);
  }
  return { start, end };
}

/** Get start of week (Monday) in UTC for a given date */
export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Get array of 7 dates (UTC midnight) for the week starting at weekStart */
export function getWeekDates(weekStart) {
  const start = new Date(weekStart);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    dates.push(d);
  }
  return dates;
}

/** 24 one-hour slots in UTC for a given date (date as UTC midnight) */
export function getSlotsForDate(dateUTC) {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    const start = new Date(dateUTC);
    start.setUTCHours(h, 0, 0, 0);
    const end = new Date(start);
    end.setUTCHours(h + 1, 0, 0, 0);
    slots.push({ start, end });
  }
  return slots;
}
