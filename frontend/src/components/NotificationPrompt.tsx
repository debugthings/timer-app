import { useState, useEffect } from 'react';
import { requestNotificationPermission } from '../utils/notifications';

export function NotificationPrompt() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if we should show the prompt
    const checkNotificationStatus = () => {
      // Don't show if already dismissed in this session
      if (dismissed) return;
      
      // Don't show if not supported
      if (!('Notification' in window)) return;
      
      // Don't show if already granted
      if (Notification.permission === 'granted') return;
      
      // Don't show if already denied
      if (Notification.permission === 'denied') return;
      
      // Check if user has seen this before
      const hasSeenPrompt = localStorage.getItem('notification-prompt-seen');
      if (hasSeenPrompt) return;
      
      // Show after a short delay to not overwhelm users
      setTimeout(() => setShow(true), 3000);
    };

    checkNotificationStatus();
  }, [dismissed]);

  const handleEnable = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      localStorage.setItem('notification-prompt-seen', 'true');
      setShow(false);
    } else {
      // Permission was denied, don't show again
      localStorage.setItem('notification-prompt-seen', 'true');
      setShow(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('notification-prompt-seen', 'true');
    setShow(false);
    setDismissed(true);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-lg shadow-xl border-2 border-blue-500 p-4 z-50 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="text-3xl">🔔</div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">
            Enable Notifications
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Get notified when timers complete or expire. Essential for tracking your time effectively.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleEnable}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Enable
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Later
            </button>
          </div>
          {('Notification' in window) && window.navigator.userAgent.includes('iPhone') && (
            <p className="text-xs text-orange-600 mt-2">
              📱 iOS: Install app to home screen for notifications
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
