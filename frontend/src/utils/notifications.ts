// Request notification permission from the user
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

// Show a notification (works with both PWA and regular browser)
export async function showNotification(title: string, options?: NotificationOptions): Promise<void> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return;
  }

  // Request permission if not granted
  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return;
    }
  }

  // Try to use service worker for better iOS support
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const notificationOptions: NotificationOptions & { vibrate?: number[] } = {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        vibrate: [200, 100, 200],
        tag: 'timer-notification',
        ...options,
      };
      await registration.showNotification(title, notificationOptions);
      return;
    } catch (error) {
      console.log('Service worker notification failed, falling back to regular notification');
    }
  }

  // Fallback to regular notification
  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      ...options,
    });
  }
}

// Play a completion sound (single beep for notifications)
export async function playCompletionSound(): Promise<void> {
  try {
    // Use a short, pleasant sound for completion notifications
    await playAlarmSound('/media/alarms/Neon.ogg');
  } catch (error) {
    console.error('Failed to play completion sound:', error);
  }
}

// Alarm sound types - expanded to include more available OGG files
export type AlarmSound =
  | 'helium' | 'firedrill' | 'cesium' | 'osmium' | 'plutonium'
  | 'neon' | 'argon' | 'krypton' | 'oxygen' | 'carbon'
  | 'analysis' | 'departure' | 'timing' | 'scandium' | 'barium'
  | 'curium' | 'fermium' | 'hassium' | 'copernicium' | 'nobelium'
  | 'neptunium' | 'promethium';

// Backward compatibility mapping for database values
const LEGACY_ALARM_SOUND_MAPPING: Record<string, AlarmSound> = {
  'classic': 'helium',
  'urgent': 'firedrill',
  'chime': 'cesium',
  'bell': 'osmium',
  'buzz': 'plutonium',
};

// Convert legacy database values to new AlarmSound type
export function normalizeAlarmSound(sound: string | AlarmSound): AlarmSound {
  if (typeof sound === 'string' && LEGACY_ALARM_SOUND_MAPPING[sound]) {
    return LEGACY_ALARM_SOUND_MAPPING[sound];
  }
  return sound as AlarmSound;
}

export const ALARM_SOUND_LABELS: Record<AlarmSound, string> = {
  helium: 'Helium',
  firedrill: 'FireDrill',
  cesium: 'Cesium',
  osmium: 'Osmium',
  plutonium: 'Plutonium',
  neon: 'Neon',
  argon: 'Argon',
  krypton: 'Krypton',
  oxygen: 'Oxygen',
  carbon: 'Carbon',
  analysis: 'Analysis',
  departure: 'Departure',
  timing: 'Timing',
  scandium: 'Scandium',
  barium: 'Barium',
  curium: 'Curium',
  fermium: 'Fermium',
  hassium: 'Hassium',
  copernicium: 'Copernicium',
  nobelium: 'Nobelium',
  neptunium: 'Neptunium',
  promethium: 'Promethium',
};

// Map alarm types to OGG files
const ALARM_SOUND_FILES: Record<AlarmSound, string> = {
  helium: '/media/alarms/Helium.ogg',
  firedrill: '/media/alarms/FireDrill.ogg',
  cesium: '/media/alarms/Cesium.ogg',
  osmium: '/media/alarms/Osmium.ogg',
  plutonium: '/media/alarms/Plutonium.ogg',
  neon: '/media/alarms/Neon.ogg',
  argon: '/media/alarms/Argon.ogg',
  krypton: '/media/alarms/Krypton.ogg',
  oxygen: '/media/alarms/Oxygen.ogg',
  carbon: '/media/alarms/Carbon.ogg',
  analysis: '/media/alarms/Analysis.ogg',
  departure: '/media/alarms/Departure.ogg',
  timing: '/media/alarms/Timing.ogg',
  scandium: '/media/alarms/Scandium.ogg',
  barium: '/media/alarms/Barium.ogg',
  curium: '/media/alarms/Curium.ogg',
  fermium: '/media/alarms/Fermium.ogg',
  hassium: '/media/alarms/Hassium.ogg',
  copernicium: '/media/alarms/Copernicium.ogg',
  nobelium: '/media/alarms/Nobelium.ogg',
  neptunium: '/media/alarms/Neptunium.ogg',
  promethium: '/media/alarms/Promethium.ogg',
};

// Audio cache for loaded sounds
const audioCache: Map<string, HTMLAudioElement> = new Map();

// Continuous alarm system
let alarmInterval: number | null = null;
let currentAlarmAudio: HTMLAudioElement | null = null;
let currentAlarmType: AlarmSound = 'helium';

function loadAudio(src: string): Promise<HTMLAudioElement> {
  return new Promise((resolve, reject) => {
    if (audioCache.has(src)) {
      resolve(audioCache.get(src)!);
      return;
    }

    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = 0.7; // Set reasonable volume

    audio.addEventListener('canplaythrough', () => {
      audioCache.set(src, audio);
      resolve(audio);
    });

    audio.addEventListener('error', () => {
      reject(new Error(`Failed to load audio: ${src}`));
    });

    audio.src = src;
  });
}

async function playAlarmSound(soundFile: string): Promise<void> {
  try {
    const audio = await loadAudio(soundFile);

    // Clone the audio for simultaneous playback
    const audioClone = audio.cloneNode() as HTMLAudioElement;
    audioClone.volume = 0.7;
    audioClone.currentTime = 0;

    // Play the sound
    await audioClone.play();

    // Clean up after playing
    audioClone.addEventListener('ended', () => {
      // Audio cleanup happens automatically
    });

  } catch (error) {
    console.error('Failed to play alarm sound:', error);
  }
}

export function startContinuousAlarm(alarmType: AlarmSound = 'helium'): void {
  if (alarmInterval) {
    return; // Already playing
  }

  currentAlarmType = alarmType;
  const soundFile = ALARM_SOUND_FILES[alarmType];

  if (!soundFile) {
    console.error(`No sound file found for alarm type: ${alarmType}`);
    return;
  }

  const playAlarmBeep = () => {
    playAlarmSound(soundFile);
  };

  // Play immediately
  playAlarmBeep();

  // Then repeat based on alarm type
  const intervals: Record<AlarmSound, number> = {
    helium: 2000,     // 2 seconds - matches Helium.ogg length
    firedrill: 1500,  // 1.5 seconds - matches FireDrill.ogg pattern
    cesium: 2500,     // 2.5 seconds - matches Cesium.ogg length
    osmium: 3000,     // 3 seconds - matches Osmium.ogg length
    plutonium: 1800,  // 1.8 seconds - matches Plutonium.ogg pattern
    neon: 2000,       // Default timing
    argon: 2200,      // Slightly different timing
    krypton: 2400,    // Varied timing
    oxygen: 2100,     // Medium timing
    carbon: 1900,     // Fast timing
    analysis: 2300,   // Analytical timing
    departure: 2500,  // Travel timing
    timing: 2000,     // Clockwork timing
    scandium: 2100,   // Unique timing
    barium: 2400,     // Heavy timing
    curium: 2600,     // Intense timing
    fermium: 2200,    // Artificial timing
    hassium: 2800,    // Powerful timing
    copernicium: 2400,// Revolutionary timing
    nobelium: 2300,   // Distinguished timing
    neptunium: 2500,  // Planetary timing
    promethium: 2200, // Gifted timing
  };

  alarmInterval = window.setInterval(playAlarmBeep, intervals[currentAlarmType]);
}

export function stopContinuousAlarm(): void {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }

  if (currentAlarmAudio) {
    currentAlarmAudio.pause();
    currentAlarmAudio.currentTime = 0;
    currentAlarmAudio = null;
  }
}
