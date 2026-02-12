import { prisma } from '../index';

// Get timezone from settings
export async function getTimezone(): Promise<string> {
  const settings = await prisma.settings.findFirst();
  return settings?.timezone || 'America/New_York'; // Default to Eastern Time
}

// Get start of day in configured timezone
export async function getStartOfDay(date: Date = new Date()): Promise<Date> {
  const timezone = await getTimezone();
  
  // Get YYYY-MM-DD in the target timezone
  const dateStr = date.toLocaleDateString('en-CA', { timeZone: timezone }); // en-CA gives YYYY-MM-DD format
  
  // Parse as UTC date at midnight (this will be stored consistently)
  const [year, month, day] = dateStr.split('-');
  const utcMidnight = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0));
  
  return utcMidnight;
}

// Get day of week - dates are stored as UTC midnight for the calendar day
export function getDayOfWeek(date: Date): number {
  return date.getUTCDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
}

// Get current time in HH:MM format for configured timezone (24-hour, zero-padded)
export async function getCurrentTime(): Promise<string> {
  const timezone = await getTimezone();
  const now = new Date();
  const timeStr = now.toLocaleString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23', // Ensure 00:00 not 24:00 for midnight
  });
  // Parse the formatted string to extract HH:MM (ensure zero-padded for correct string comparison)
  const match = timeStr.match(/(\d{1,2}):(\d{1,2})/);
  if (match) {
    const h = match[1].padStart(2, '0');
    const m = match[2].padStart(2, '0');
    return `${h}:${m}`;
  }
  return timeStr;
}

// Get seconds allocation for a specific day based on timer schedule or default
export async function getSecondsForDay(timerId: string, date: Date): Promise<number> {
  const dayOfWeek = getDayOfWeek(date);
  
  // Check if there's a schedule for this day
  const schedule = await prisma.timerSchedule.findUnique({
    where: {
      timerId_dayOfWeek: {
        timerId,
        dayOfWeek,
      },
    },
  });
  
  if (schedule) {
    return schedule.seconds;
  }
  
  // Fall back to timer's default
  const timer = await prisma.timer.findUnique({
    where: { id: timerId },
  });
  
  return timer?.defaultDailySeconds || 0;
}
