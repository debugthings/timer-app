import { useState, FormEvent } from 'react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel?: () => void;
  onSubmit: (pin: string) => Promise<void>;
  title: string;
  isFirstTime?: boolean;
  requireCurrentPin?: boolean;
}

export function PinModal({
  isOpen,
  onClose,
  onCancel,
  onSubmit,
  title,
  isFirstTime = false,
  requireCurrentPin = false,
}: PinModalProps) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (isFirstTime || requireCurrentPin) {
      if (newPin !== confirmPin) {
        setError('PINs do not match');
        return;
      }
      if (!/^\d{4,}$/.test(newPin)) {
        setError('PIN must be at least 4 digits and contain only numbers');
        return;
      }
    }

    setLoading(true);
    try {
      if (isFirstTime || requireCurrentPin) {
        await onSubmit(newPin);
      } else {
        await onSubmit(currentPin);
      }
      // Success - clear fields and close modal
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setLoading(false);
      onClose();
    } catch (err: unknown) {
      setLoading(false);
      const errorMessage = err instanceof Error 
        ? err.message 
        : (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Invalid PIN';
      setError(errorMessage);
    }
  };

  const handleCancel = () => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setError('');
    if (onCancel) {
      onCancel();
    } else {
      onClose();
    }
  };

  const handleNumericInput = (value: string, setter: (value: string) => void) => {
    // Only allow numeric characters
    const numericValue = value.replace(/[^0-9]/g, '');
    setter(numericValue);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{title}</h2>
        <form onSubmit={handleSubmit}>
          {requireCurrentPin && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">Current PIN</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={currentPin}
                onChange={(e) => handleNumericInput(e.target.value, setCurrentPin)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
                autoFocus
                maxLength={10}
              />
            </div>
          )}

          {(isFirstTime || requireCurrentPin) ? (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">New PIN (4+ digits)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={newPin}
                  onChange={(e) => handleNumericInput(e.target.value, setNewPin)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  minLength={4}
                  required
                  autoFocus={!requireCurrentPin}
                  maxLength={10}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">Confirm PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={confirmPin}
                  onChange={(e) => handleNumericInput(e.target.value, setConfirmPin)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  minLength={4}
                  required
                  maxLength={10}
                />
              </div>
            </>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">Enter Admin PIN</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={currentPin}
                onChange={(e) => handleNumericInput(e.target.value, setCurrentPin)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
                autoFocus
                maxLength={10}
              />
            </div>
          )}

          {error && <div className="text-red-500 dark:text-red-400 text-sm mb-4">{error}</div>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
