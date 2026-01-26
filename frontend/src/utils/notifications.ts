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

// Play a completion sound
export function playCompletionSound(): void {
  try {
    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create oscillator for beep sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure sound - pleasant notification beep
    oscillator.frequency.value = 800; // Hz
    oscillator.type = 'sine';
    
    // Fade in and out for smoother sound
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
    
    // Play for 0.5 seconds
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
    // Play a second beep
    setTimeout(() => {
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();
      
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);
      
      oscillator2.frequency.value = 1000; // Slightly higher pitch
      oscillator2.type = 'sine';
      
      gainNode2.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode2.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
      gainNode2.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
      
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + 0.5);
    }, 200);
    
  } catch (error) {
    console.error('Failed to play sound:', error);
  }
}

// Alarm sound types
export type AlarmSound = 'classic' | 'urgent' | 'chime' | 'bell' | 'buzz';

export const ALARM_SOUND_LABELS: Record<AlarmSound, string> = {
  classic: '🔔 Classic',
  urgent: '⚠️ Urgent',
  chime: '🎵 Chime',
  bell: '🔔 Bell',
  buzz: '📳 Buzz',
};

// Continuous alarm system
let alarmInterval: number | null = null;
let alarmAudioContext: AudioContext | null = null;
let currentAlarmType: AlarmSound = 'classic';

// Alarm sound generators
const alarmSoundGenerators: Record<AlarmSound, (ctx: AudioContext) => void> = {
  classic: (ctx: AudioContext) => {
    // Two-tone classic alarm
    const playTone = (freq: number, delay: number) => {
      setTimeout(() => {
        if (!ctx) return;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'square';
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
      }, delay);
    };
    
    playTone(880, 0);    // A5
    playTone(1108, 350); // C#6
  },
  
  urgent: (ctx: AudioContext) => {
    // Fast, high-pitched repeating alarm
    const playBeep = (delay: number) => {
      setTimeout(() => {
        if (!ctx) return;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.value = 1400;
        oscillator.type = 'sawtooth';
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.02);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.15);
      }, delay);
    };
    
    playBeep(0);
    playBeep(200);
    playBeep(400);
  },
  
  chime: (ctx: AudioContext) => {
    // Pleasant chime sound
    const playNote = (freq: number, delay: number, duration: number) => {
      setTimeout(() => {
        if (!ctx) return;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
      }, delay);
    };
    
    // Pleasant chord progression
    playNote(523, 0, 0.8);    // C5
    playNote(659, 100, 0.8);  // E5
    playNote(784, 200, 1.0);  // G5
  },
  
  bell: (ctx: AudioContext) => {
    // Church bell-like sound
    const playBell = () => {
      if (!ctx) return;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 440; // A4
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 1.2);
    };
    
    playBell();
  },
  
  buzz: (ctx: AudioContext) => {
    // Vibration-like buzz
    const playBuzz = (delay: number) => {
      setTimeout(() => {
        if (!ctx) return;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.value = 200;
        oscillator.type = 'sawtooth';
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
      }, delay);
    };
    
    playBuzz(0);
    playBuzz(100);
    playBuzz(200);
    playBuzz(300);
  },
};

export function startContinuousAlarm(alarmType: AlarmSound = 'classic'): void {
  if (alarmInterval) {
    return; // Already playing
  }

  currentAlarmType = alarmType;

  try {
    alarmAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playAlarmBeep = () => {
      if (!alarmAudioContext) return;
      const generator = alarmSoundGenerators[currentAlarmType];
      if (generator) {
        generator(alarmAudioContext);
      }
    };
    
    // Play immediately
    playAlarmBeep();
    
    // Then repeat based on alarm type
    const intervals: Record<AlarmSound, number> = {
      classic: 1500,
      urgent: 800,
      chime: 2000,
      bell: 2500,
      buzz: 1200,
    };
    
    alarmInterval = window.setInterval(playAlarmBeep, intervals[currentAlarmType]);
    
  } catch (error) {
    console.error('Failed to start alarm:', error);
  }
}

export function stopContinuousAlarm(): void {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
  
  if (alarmAudioContext) {
    alarmAudioContext.close();
    alarmAudioContext = null;
  }
}
