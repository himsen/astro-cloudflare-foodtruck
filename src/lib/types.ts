export interface WeeklyStop {
  weekday: number; // 0 = Monday .. 6 = Sunday
  location_name: string | null; // null means closed this weekday
  address: string | null;
  map_url: string | null;
  start_time: string | null; // 'HH:MM'
  end_time: string | null; // 'HH:MM'
  note: string | null;
}

export interface ScheduleException {
  date: string; // 'YYYY-MM-DD'
  is_closed: number; // 0 or 1
  location_name: string | null;
  address: string | null;
  map_url: string | null;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
}

export interface DayEntry {
  date: string;
  weekday: number;
  weekdayName: string;
  displayDate: string;
  isToday: boolean;
  isClosed: boolean;
  isException: boolean;
  locationName: string | null;
  address: string | null;
  mapUrl: string | null;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
}

export interface Banner {
  text: string;
  until: string; // 'YYYY-MM-DD', inclusive
}
