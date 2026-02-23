export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function getSlotCount(
  dayStartTime: string,
  dayEndTime: string,
  slotMinutes: number,
): number {
  const rangeMinutes = toMinutes(dayEndTime) - toMinutes(dayStartTime);
  return Math.max(0, Math.floor(rangeMinutes / slotMinutes));
}

export function getDateRange(startDate: string, endDate: string): string[] {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const year = cursor.getUTCFullYear();
    const month = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const day = String(cursor.getUTCDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export function getSlotLabels(
  dayStartTime: string,
  dayEndTime: string,
  slotMinutes: number,
): string[] {
  const labels: string[] = [];
  const slotCount = getSlotCount(dayStartTime, dayEndTime, slotMinutes);
  const start = toMinutes(dayStartTime);

  for (let i = 0; i < slotCount; i += 1) {
    const total = start + i * slotMinutes;
    const hour = String(Math.floor(total / 60)).padStart(2, "0");
    const minute = String(total % 60).padStart(2, "0");
    labels.push(`${hour}:${minute}`);
  }

  return labels;
}

export function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isValidTimeString(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hour, minute] = value.split(":").map(Number);
  if (hour < 0 || hour > 24 || minute < 0 || minute >= 60) {
    return false;
  }

  if (hour === 24 && minute !== 0) {
    return false;
  }

  return true;
}
