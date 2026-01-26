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

// Show a notification
export function showNotification(title: string, options?: NotificationOptions): void {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
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

// Continuous alarm system
let alarmInterval: number | null = null;
let alarmAudioContext: AudioContext | null = null;

export function startContinuousAlarm(): void {
  if (alarmInterval) {
    return; // Already playing
  }

  try {
    alarmAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playAlarmBeep = () => {
      if (!alarmAudioContext) return;
      
      // Create oscillator for alarm sound
      const oscillator = alarmAudioContext.createOscillator();
      const gainNode = alarmAudioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(alarmAudioContext.destination);
      
      // More urgent alarm sound
      oscillator.frequency.value = 880; // A5 note
      oscillator.type = 'square'; // More attention-grabbing sound
      
      // Quick fade in and out
      gainNode.gain.setValueAtTime(0, alarmAudioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.4, alarmAudioContext.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, alarmAudioContext.currentTime + 0.3);
      
      oscillator.start(alarmAudioContext.currentTime);
      oscillator.stop(alarmAudioContext.currentTime + 0.3);
      
      // Second beep in the pattern
      setTimeout(() => {
        if (!alarmAudioContext) return;
        
        const oscillator2 = alarmAudioContext.createOscillator();
        const gainNode2 = alarmAudioContext.createGain();
        
        oscillator2.connect(gainNode2);
        gainNode2.connect(alarmAudioContext.destination);
        
        oscillator2.frequency.value = 1108; // C#6 note (higher)
        oscillator2.type = 'square';
        
        gainNode2.gain.setValueAtTime(0, alarmAudioContext.currentTime);
        gainNode2.gain.linearRampToValueAtTime(0.4, alarmAudioContext.currentTime + 0.05);
        gainNode2.gain.linearRampToValueAtTime(0, alarmAudioContext.currentTime + 0.3);
        
        oscillator2.start(alarmAudioContext.currentTime);
        oscillator2.stop(alarmAudioContext.currentTime + 0.3);
      }, 350);
    };
    
    // Play immediately
    playAlarmBeep();
    
    // Then repeat every 1.5 seconds
    alarmInterval = window.setInterval(playAlarmBeep, 1500);
    
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
