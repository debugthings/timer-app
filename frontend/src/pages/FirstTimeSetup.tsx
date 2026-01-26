import { useState } from 'react';
import { PinModal } from '../components/Admin/PinModal';
import { setPin } from '../services/api';
import { useAdmin } from '../contexts/AdminContext';

interface FirstTimeSetupProps {
  onPinSet: () => void;
}

export function FirstTimeSetup({ onPinSet }: FirstTimeSetupProps) {
  const { setAdminPin } = useAdmin();
  const [showPinModal, setShowPinModal] = useState(true);

  const handleSetPin = async (pin: string) => {
    await setPin({ newPin: pin });
    setAdminPin(pin);
    onPinSet();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <h1 className="text-4xl font-bold mb-4">Welcome to Timer App</h1>
        <p className="text-gray-600 mb-8">
          Set up your admin PIN to get started. You'll use this PIN to manage people, timers, and allocations.
        </p>
        <button
          onClick={() => setShowPinModal(true)}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
        >
          Set Admin PIN
        </button>
      </div>

      <PinModal
        isOpen={showPinModal}
        onClose={() => {}}
        onSubmit={handleSetPin}
        title="Set Admin PIN"
        isFirstTime={true}
      />
    </div>
  );
}
