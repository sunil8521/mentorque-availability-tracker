/**
 * Frontend time handling: display in user's timezone (UTC or IST), send UTC to API.
 */

import { DateTime } from "luxon";

function resolveIanaZone(timezone) {
  // Never hardcode offsets; always use IANA zones so DST is handled automatically.
  if (timezone === "IST") return "Asia/Kolkata";
  // In this app, the "UTC/GMT" option is used for Ireland/UK-style time.
  // Use Europe/Dublin so Ireland DST (IST / Irish Summer Time) is handled.
  if (timezone === "UTC") return "Europe/Dublin";
  return timezone || "UTC";
}

export function getUserOffsetMs(timezone) {
  const zone = resolveIanaZone(timezone);
  return DateTime.now().setZone(zone).offset * 60 * 1000;
}

export function toLocalISO(date, timezone) {
  const zone = resolveIanaZone(timezone);
  return DateTime.fromJSDate(new Date(date), { zone: "utc" }).setZone(zone).toJSDate();
}

export function formatDateLocal(dateStr, timezone) {
  const zone = resolveIanaZone(timezone);
  const iso =
    typeof dateStr === "string"
      ? `${dateStr}T00:00:00Z`
      : DateTime.fromJSDate(new Date(dateStr), { zone: "utc" }).toISO();
  const dt = DateTime.fromISO(iso, { zone: "utc" }).setZone(zone);
  return dt.toFormat("ccc, LLL d");
}

export function formatTimeLocal(isoString, timezone) {
  const zone = resolveIanaZone(timezone);
  return DateTime.fromISO(isoString, { zone: "utc" }).setZone(zone).toFormat("HH:mm");
}

export function formatTo12Hour(timeStr) {
  if (!timeStr) return "";

  const [hourStr, minuteStr = "00"] = timeStr.split(":");
  let hours = parseInt(hourStr, 10);

  if (Number.isNaN(hours) || hours < 0 || hours > 23) return timeStr;

  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;

  return `${String(hours).padStart(2, "0")}:${minuteStr.padStart(2, "0")} ${period}`;
}

export function formatTimeRange(rangeStr) {
  if (!rangeStr) return "";

  const parts = rangeStr.split("–");
  if (parts.length !== 2) return rangeStr;

  const [start, end] = parts.map((p) => p.trim());
  if (!start || !end) return rangeStr;

  return `${formatTo12Hour(start)} – ${formatTo12Hour(end)}`;
}

export function formatSlotLabel(startISO, endISO, timezone) {
  const start = formatTimeLocal(startISO, timezone);
  const end = formatTimeLocal(endISO, timezone);
  return formatTimeRange(`${start} – ${end}`);
}

/**
 * Check if date (YYYY-MM-DD) is in the past.
 * Both dateStr and "today" are compared as UTC calendar dates so timezone
 * offset cannot make tomorrow appear as past (e.g. 11:30 PM IST March 15
 * is still March 15 UTC; March 16 UTC is never past).
 */
export function isPastDate(dateStr) {
  const utcTodayStr = new Date().toISOString().slice(0, 10);
  return dateStr < utcTodayStr;
}

export function isPastDateTime(isoString, nowMs = Date.now()) {
  return new Date(isoString).getTime() <= nowMs;
}

/** True when this grid cell's start time has passed (any day, not only UTC today). */
export function isSlotInPast(dateStr, hour, nowMs = Date.now()) {
  if (!dateStr) return false;
  return isPastDateTime(slotToUTC(dateStr, hour).startTime, nowMs);
}

/** Get start of week (Monday) for a date, in UTC date string YYYY-MM-DD */
export function getWeekStartStr(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/** Build UTC ISO strings for a slot on a given date (YYYY-MM-DD) and hour (0-23) */
export function slotToUTC(dateStr, hour) {
  const start = new Date(dateStr + "T00:00:00.000Z");
  start.setUTCHours(hour, 0, 0, 0);
  const end = new Date(start);
  end.setUTCHours(hour + 1, 0, 0, 0);
  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

/** Parse local time (HH:mm) on date (YYYY-MM-DD) in user timezone to UTC ISO */
export function localToUTC(dateStr, timeStr, timezone) {
  const zone = resolveIanaZone(timezone);
  const dt = DateTime.fromFormat(`${dateStr} ${timeStr}`, "yyyy-MM-dd HH:mm", { zone });
  if (!dt.isValid) return new Date(`${dateStr}T${timeStr}:00.000Z`).toISOString();
  return dt.toUTC().toISO();
}

export function getWeekDates(weekStartStr) {
  const start = new Date(weekStartStr + "T00:00:00Z");
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/** Mon–Sun dates for the calendar week containing today, shifted by weekOffset weeks. */
export function getViewWeekDates(weekOffset = 0) {
  const today = new Date();
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const monday = new Date(getWeekStartStr(base) + "T00:00:00Z");
  monday.setUTCDate(monday.getUTCDate() + weekOffset * 7);
  return getWeekDates(monday.toISOString().slice(0, 10));
}

/** Convert UTC (date, hour) to IST (date, hour) for display */
export function convertUTCToIST(utcDateStr, utcHour) {
  const utcMoment = DateTime.fromISO(`${utcDateStr}T00:00:00Z`, { zone: "utc" }).set({
    hour: utcHour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  const istMoment = utcMoment.setZone("Asia/Kolkata");
  return {
    dateStr: istMoment.toISOString().slice(0, 10),
    hour: istMoment.hour,
  };
}

/** Convert (UTC date column + IST hour) to UTC (date, hour) for storage */
export function convertISTToUTC(utcDateStr, istHour) {
  const istMoment = DateTime.fromISO(`${utcDateStr}T00:00:00Z`, { zone: "utc" })
    .setZone("Asia/Kolkata")
    .set({ hour: istHour, minute: 0, second: 0, millisecond: 0 });
  const utcMoment = istMoment.toUTC();
  return {
    utcDateStr: utcMoment.toISOString().slice(0, 10),
    utcHour: utcMoment.hour,
  };
}

export function fmtBlockLabel(startISO, endISO, ianaTz) {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const fmt = (d) =>
    d.toLocaleTimeString("en-US", { timeZone: ianaTz, hour: "2-digit", minute: "2-digit", hour12: true });
  return `${fmt(s)} - ${fmt(e)}`;
}
