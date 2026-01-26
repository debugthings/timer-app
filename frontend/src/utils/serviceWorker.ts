// Service Worker registration for PWA
// Note: VitePWA plugin handles registration automatically
export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    // Request notification permission early
    requestNotificationPermission();
  }
}

// Request notification permission from the user
async function requestNotificationPermission(): Promise<void> {
  if (!('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'default') {
    // Don't auto-prompt, wait for user action
    console.log('Notification permission not yet requested');
  }
}

// Request notification permission and setup push notifications
export async function setupPushNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications not supported');
    return false;
  }
  
  try {
    await navigator.serviceWorker.ready;
    
    // Request notification permission
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }
    
    console.log('Push notifications enabled');
    return true;
    
  } catch (error) {
    console.error('Failed to setup push notifications:', error);
    return false;
  }
}

// Check if app is running as PWA
export function isPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true ||
         document.referrer.includes('android-app://');
}

// Show install prompt for PWA
export function showInstallPrompt(): void {
  let deferredPrompt: any;
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show your custom install UI here
    console.log('PWA install prompt available');
  });
  
  // If user wants to install
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      deferredPrompt = null;
    });
  }
}
