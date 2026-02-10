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

// Alarm sound types - expanded to include more available OGG files + ringtones
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
  acheron: 'Acheron',
  andromeda: 'Andromeda',
  aquila: 'Aquila',
  argonavis: 'ArgoNavis',
  atria: 'Atria',
  bootes: 'Bootes',
  callisto: 'Callisto',
  canismajor: 'CanisMajor',
  carina: 'Carina',
  cassiopeia: 'Cassiopeia',
  centaurus: 'Centaurus',
  cygnus: 'Cygnus',
  draco: 'Draco',
  eridani: 'Eridani',
  ganymede: 'Ganymede',
  girtab: 'Girtab',
  hydra: 'Hydra',
  iridium: 'Iridium',
  kuma: 'Kuma',
  luna: 'Luna',
  lyra: 'Lyra',
  machina: 'Machina',
  nasqueron: 'Nasqueron',
  oberon: 'Oberon',
  orion: 'Orion',
  pegasus: 'Pegasus',
  perseus: 'Perseus',
  phobos: 'Phobos',
  pyxis: 'Pyxis',
  rasalas: 'Rasalas',
  rigel: 'Rigel',
  scarabaeus: 'Scarabaeus',
  sceptrum: 'Sceptrum',
  solarium: 'Solarium',
  testudo: 'Testudo',
  themos: 'Themos',
  titania: 'Titania',
  triton: 'Triton',
  umbriel: 'Umbriel',
  ursaminor: 'UrsaMinor',
  vespa: 'Vespa',
};

// Map alarm types to OGG files (removed duplicates point to kept file)
const ALARM_SOUND_FILES: Record<AlarmSound, string> = {
  helium: '/media/alarms/Helium.ogg',
  firedrill: '/media/alarms/Plutonium.ogg',   // dup removed, higher quality Plutonium kept
  cesium: '/media/alarms/Cesium.ogg',
  osmium: '/media/alarms/Osmium.ogg',
  plutonium: '/media/alarms/Plutonium.ogg',
  neon: '/media/alarms/Neon.ogg',
  argon: '/media/alarms/Argon.ogg',
  krypton: '/media/alarms/Plutonium.ogg',     // dup removed, higher quality Plutonium kept
  oxygen: '/media/alarms/Cesium.ogg',         // dup removed, metadata-only Cesium kept
  carbon: '/media/alarms/Carbon.ogg',
  analysis: '/media/alarms/Analysis.ogg',
  departure: '/media/alarms/Departure.ogg',
  timing: '/media/alarms/Scandium.ogg',       // dup removed, higher quality Scandium kept
  scandium: '/media/alarms/Scandium.ogg',
  barium: '/media/alarms/Analysis.ogg',       // dup removed, higher quality Analysis kept
  curium: '/media/alarms/Curium.ogg',
  fermium: '/media/alarms/Argon.ogg',         // dup removed, metadata-only Argon kept
  hassium: '/media/alarms/Helium.ogg',        // dup removed, metadata-only Helium kept
  copernicium: '/media/alarms/Copernicium.ogg',
  nobelium: '/media/alarms/Neon.ogg',         // dup removed, metadata-only Neon kept
  neptunium: '/media/alarms/Carbon.ogg',      // dup removed, metadata-only Carbon kept
  promethium: '/media/alarms/Promethium.ogg',
  acheron: '/media/sounds/ringtones/Acheron.ogg',
  andromeda: '/media/sounds/ringtones/Andromeda.ogg',
  aquila: '/media/sounds/ringtones/Aquila.ogg',
  argonavis: '/media/sounds/ringtones/ArgoNavis.ogg',
  atria: '/media/sounds/ringtones/Atria.ogg',
  bootes: '/media/sounds/ringtones/Bootes.ogg',
  callisto: '/media/sounds/ringtones/Callisto.ogg',
  canismajor: '/media/sounds/ringtones/CanisMajor.ogg',
  carina: '/media/sounds/ringtones/Carina.ogg',
  cassiopeia: '/media/sounds/ringtones/Cassiopeia.ogg',
  centaurus: '/media/sounds/ringtones/Centaurus.ogg',
  cygnus: '/media/sounds/ringtones/Cygnus.ogg',
  draco: '/media/sounds/ringtones/Draco.ogg',
  eridani: '/media/sounds/ringtones/Eridani.ogg',
  ganymede: '/media/sounds/ringtones/Ganymede.ogg',
  girtab: '/media/sounds/ringtones/Girtab.ogg',
  hydra: '/media/sounds/ringtones/Hydra.ogg',
  iridium: '/media/sounds/ringtones/Iridium.ogg',
  kuma: '/media/sounds/ringtones/Kuma.ogg',
  luna: '/media/sounds/ringtones/Luna.ogg',
  lyra: '/media/sounds/ringtones/Lyra.ogg',
  machina: '/media/sounds/ringtones/Machina.ogg',
  nasqueron: '/media/sounds/ringtones/Nasqueron.ogg',
  oberon: '/media/sounds/ringtones/Oberon.ogg',
  orion: '/media/sounds/ringtones/Orion.ogg',
  pegasus: '/media/sounds/ringtones/Pegasus.ogg',
  perseus: '/media/sounds/ringtones/Perseus.ogg',
  phobos: '/media/sounds/ringtones/Phobos.ogg',
  pyxis: '/media/sounds/ringtones/Pyxis.ogg',
  rasalas: '/media/sounds/ringtones/Rasalas.ogg',
  rigel: '/media/sounds/ringtones/Rigel.ogg',
  scarabaeus: '/media/sounds/ringtones/Scarabaeus.ogg',
  sceptrum: '/media/sounds/ringtones/Sceptrum.ogg',
  solarium: '/media/sounds/ringtones/Solarium.ogg',
  testudo: '/media/sounds/ringtones/Testudo.ogg',
  themos: '/media/sounds/ringtones/Themos.ogg',
  titania: '/media/sounds/ringtones/Titania.ogg',
  triton: '/media/sounds/ringtones/Triton.ogg',
  umbriel: '/media/sounds/ringtones/Umbriel.ogg',
  ursaminor: '/media/sounds/ringtones/UrsaMinor.ogg',
  vespa: '/media/sounds/ringtones/Vespa.ogg',
};

// Audio cache for loaded sounds
const audioCache: Map<string, HTMLAudioElement> = new Map();

// Continuous alarm system
let alarmInterval: number | null = null;
let currentAlarmAudio: HTMLAudioElement | null = null;
let currentAlarmType: AlarmSound = 'helium';

// Currently playing preview audio (for dropdown previews)
let currentPreviewAudio: HTMLAudioElement | null = null;

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

async function playAlarmSound(soundFile: string, isPreview: boolean = false): Promise<void> {
  try {
    // Stop any currently playing preview before starting new one
    if (isPreview && currentPreviewAudio) {
      currentPreviewAudio.pause();
      currentPreviewAudio.currentTime = 0;
      currentPreviewAudio = null;
    }

    const audio = await loadAudio(soundFile);

    // Clone the audio for playback
    const audioClone = audio.cloneNode() as HTMLAudioElement;
    audioClone.volume = 0.7;
    audioClone.currentTime = 0;

    // Track the audio if it's a preview
    if (isPreview) {
      currentPreviewAudio = audioClone;
    }

    // Play the sound
    await audioClone.play();

    // Clean up after playing
    audioClone.addEventListener('ended', () => {
      if (isPreview && currentPreviewAudio === audioClone) {
        currentPreviewAudio = null;
      }
    });

    // For previews, stop after 1.5 seconds
    if (isPreview) {
      setTimeout(() => {
        if (currentPreviewAudio === audioClone) {
          audioClone.pause();
          audioClone.currentTime = 0;
          currentPreviewAudio = null;
        }
      }, 1500);
    }

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
    playAlarmSound(soundFile, false); // false = continuous alarm, not preview
  };

  // Play immediately
  playAlarmBeep();

  // Then repeat based on alarm type (ringtones use 2500ms default)
  const intervals: Record<AlarmSound, number> = {
    helium: 2000, firedrill: 1500, cesium: 2500, osmium: 3000, plutonium: 1800,
    neon: 2000, argon: 2200, krypton: 2400, oxygen: 2100, carbon: 1900,
    analysis: 2300, departure: 2500, timing: 2000, scandium: 2100, barium: 2400,
    curium: 2600, fermium: 2200, hassium: 2800, copernicium: 2400, nobelium: 2300,
    neptunium: 2500, promethium: 2200,
    acheron: 2500, andromeda: 2500, aquila: 2500, argonavis: 2500, atria: 2500,
    bootes: 2500, callisto: 2500, canismajor: 2500, carina: 2500, cassiopeia: 2500,
    centaurus: 2500, cygnus: 2500, draco: 2500, eridani: 2500, ganymede: 2500,
    girtab: 2500, hydra: 2500, iridium: 2500, kuma: 2500, luna: 2500, lyra: 2500,
    machina: 2500, nasqueron: 2500, oberon: 2500, orion: 2500, pegasus: 2500,
    perseus: 2500, phobos: 2500, pyxis: 2500, rasalas: 2500, rigel: 2500,
    scarabaeus: 2500, sceptrum: 2500, solarium: 2500, testudo: 2500, themos: 2500,
    titania: 2500, triton: 2500, umbriel: 2500, ursaminor: 2500, vespa: 2500,
  };

  alarmInterval = window.setInterval(playAlarmBeep, intervals[currentAlarmType]);
}

export async function playAlarmPreview(sound: AlarmSound): Promise<void> {
  const soundFile = ALARM_SOUND_FILES[sound];
  if (soundFile) {
    await playAlarmSound(soundFile, true); // true = preview mode
  }
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

  // Also stop any playing preview
  if (currentPreviewAudio) {
    currentPreviewAudio.pause();
    currentPreviewAudio.currentTime = 0;
    currentPreviewAudio = null;
  }
}
