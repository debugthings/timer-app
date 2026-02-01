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

// Alarm sound types
export type AlarmSound = 'classic' | 'urgent' | 'chime' | 'bell' | 'buzz';

export const ALARM_SOUND_LABELS: Record<AlarmSound, string> = {
  classic: 'Helium',
  urgent: 'FireDrill',
  chime: 'Cesium',
  bell: 'Osmium',
  buzz: 'Plutonium',
};

// Map alarm types to OGG files
const ALARM_SOUND_FILES: Record<AlarmSound, string> = {
  classic: '/media/alarms/Helium.ogg',     // Clear, classic alarm
  urgent: '/media/alarms/FireDrill.ogg',  // Urgent, attention-grabbing
  chime: '/media/alarms/Cesium.ogg',      // Pleasant, melodic
  bell: '/media/alarms/Osmium.ogg',       // Bell-like, resonant
  buzz: '/media/alarms/Plutonium.ogg',    // Buzzing, vibrating
};

// Audio cache for loaded sounds
const audioCache: Map<string, HTMLAudioElement> = new Map();

// Continuous alarm system
let alarmInterval: number | null = null;
let currentAlarmAudio: HTMLAudioElement | null = null;
let currentAlarmType: AlarmSound = 'classic';

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

export function startContinuousAlarm(alarmType: AlarmSound = 'classic'): void {
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
    classic: 2000,  // 2 seconds - matches Helium.ogg length
    urgent: 1500,   // 1.5 seconds - matches FireDrill.ogg pattern
    chime: 2500,    // 2.5 seconds - matches Cesium.ogg length
    bell: 3000,     // 3 seconds - matches Osmium.ogg length
    buzz: 1800,     // 1.8 seconds - matches Plutonium.ogg pattern
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
