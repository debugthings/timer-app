export interface Settings {
  hasPinConfigured: boolean;
  timezone: string;
}

export interface Person {
  id: string;
  name: string;
  timers?: Timer[];
  createdAt: string;
}

export interface TimerSchedule {
  id: string;
  timerId: string;
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  seconds: number;
  startTime?: string; // HH:MM format (24hr)
  expirationTime?: string; // HH:MM format (24hr)
  createdAt: string;
}

export type AlarmSound =
  | 'helium' | 'firedrill' | 'cesium' | 'osmium' | 'plutonium'
  | 'neon' | 'argon' | 'krypton' | 'oxygen' | 'carbon'
  | 'analysis' | 'departure' | 'timing' | 'scandium' | 'barium'
  | 'curium' | 'fermium' | 'hassium' | 'copernicium' | 'nobelium'
  | 'neptunium' | 'promethium'
  | 'acheron' | 'andromeda' | 'aquila' | 'argonavis' | 'atria' | 'bootes' | 'callisto'
  | 'canismajor' | 'carina' | 'cassiopeia' | 'centaurus' | 'cygnus' | 'draco' | 'eridani'
  | 'ganymede' | 'girtab' | 'hydra' | 'iridium' | 'kuma' | 'luna' | 'lyra' | 'machina'
  | 'nasqueron' | 'oberon' | 'orion' | 'pegasus' | 'perseus' | 'phobos' | 'pyxis' | 'rasalas'
  | 'rigel' | 'scarabaeus' | 'sceptrum' | 'solarium' | 'testudo' | 'themos' | 'titania'
  | 'triton' | 'umbriel' | 'ursaminor' | 'vespa';

export interface Timer {
  id: string;
  name: string;
  personId: string;
  person?: Person;
  defaultDailySeconds: number;
  defaultStartTime?: string; // HH:MM format (24hr) - applies to all days unless schedule overrides
  defaultExpirationTime?: string; // HH:MM format (24hr) - applies to all days unless schedule overrides
  alarmSound: AlarmSound; // Alarm sound type
  forceActiveAt?: string; // ISO date string when timer was forcibly activated by admin
  forceExpiredAt?: string; // ISO date string when timer was forcibly expired by admin
  schedules?: TimerSchedule[];
  todayAllocation?: DailyAllocation;
  createdAt: string;
}

export interface DailyAllocation {
  id: string;
  timerId: string;
  date: string;
  totalSeconds: number;
  usedSeconds: number;
  checkouts?: Checkout[];
  createdAt: string;
}

export type CheckoutStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface Checkout {
  id: string;
  timerId: string;
  timer?: Timer;
  allocationId: string;
  allocation?: DailyAllocation;
  allocatedSeconds: number;
  usedSeconds: number;
  status: CheckoutStatus;
  entries?: TimeEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  checkoutId: string;
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
  createdAt: string;
}

export interface CreatePersonRequest {
  name: string;
}

export interface CreateTimerRequest {
  name: string;
  personId: string;
  defaultDailySeconds: number;
  defaultStartTime?: string;
  defaultExpirationTime?: string;
  alarmSound?: AlarmSound;
  schedules?: Array<{ dayOfWeek: number; seconds: number; startTime?: string; expirationTime?: string }>;
}

export interface UpdateTimerRequest {
  name?: string;
  personId?: string;
  defaultDailySeconds?: number;
  defaultStartTime?: string;
  defaultExpirationTime?: string;
  alarmSound?: AlarmSound;
  schedules?: Array<{ dayOfWeek: number; seconds: number; startTime?: string; expirationTime?: string }>;
}

export interface UpdateAllocationRequest {
  date?: string;
  totalSeconds: number;
}

export interface CreateCheckoutRequest {
  timerId: string;
  allocatedSeconds: number;
}

export interface VerifyPinRequest {
  pin: string;
}

export interface SetPinRequest {
  currentPin?: string;
  newPin: string;
}
