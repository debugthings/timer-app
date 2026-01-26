import { useState, FormEvent } from 'react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => Promise<void>;
  title: string;
  isFirstTime?: boolean;
  requireCurrentPin?: boolean;
}

export function PinModal({
  isOpen,
  onClose,
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
      if (newPin.length < 4) {
        setError('PIN must be at least 4 characters');
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
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        <form onSubmit={handleSubmit}>
          {requireCurrentPin && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Current PIN</label>
              <input
                type="password"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                autoFocus
              />
            </div>
          )}

          {(isFirstTime || requireCurrentPin) ? (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">New PIN</label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  minLength={4}
                  required
                  autoFocus={!requireCurrentPin}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Confirm PIN</label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  minLength={4}
                  required
                />
              </div>
            </>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Enter Admin PIN</label>
              <input
                type="password"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                autoFocus
              />
            </div>
          )}

          {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
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
