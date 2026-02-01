import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { startContinuousAlarm, stopContinuousAlarm, AlarmSound } from '../utils/notifications';

interface AlarmState {
  isActive: boolean;
  timerName: string;
  personName?: string;
  reason: 'completed' | 'expired';
  sound: AlarmSound;
}

interface GlobalAlarmContextType {
  alarmState: AlarmState | null;
  triggerAlarm: (timerName: string, personName?: string, reason?: 'completed' | 'expired', sound?: AlarmSound) => void;
  acknowledgeAlarm: () => void;
}

const GlobalAlarmContext = createContext<GlobalAlarmContextType | null>(null);

export function GlobalAlarmProvider({ children }: { children: ReactNode }) {
  const [alarmState, setAlarmState] = useState<AlarmState | null>(null);

  const triggerAlarm = useCallback((
    timerName: string,
    personName?: string,
    reason: 'completed' | 'expired' = 'completed',
    sound: AlarmSound = 'classic'
  ) => {
    // Only trigger if not already active (prevent duplicates)
    if (alarmState?.isActive) return;

    setAlarmState({
      isActive: true,
      timerName,
      personName,
      reason,
      sound,
    });

    // Start the continuous alarm sound
    startContinuousAlarm(sound);
  }, [alarmState?.isActive]);

  const acknowledgeAlarm = useCallback(() => {
    if (alarmState?.isActive) {
      // Stop the alarm sound
      stopContinuousAlarm();

      // Clear the alarm state
      setAlarmState(null);
    }
  }, [alarmState?.isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopContinuousAlarm();
    };
  }, []);

  return (
    <GlobalAlarmContext.Provider value={{
      alarmState,
      triggerAlarm,
      acknowledgeAlarm,
    }}>
      {children}
    </GlobalAlarmContext.Provider>
  );
}

export function useGlobalAlarm() {
  const context = useContext(GlobalAlarmContext);
  if (!context) {
    throw new Error('useGlobalAlarm must be used within a GlobalAlarmProvider');
  }
  return context;
}