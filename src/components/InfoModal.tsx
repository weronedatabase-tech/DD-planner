import React from 'react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-sm shadow-xl">
        <h3 className="font-bold text-lg mb-4 dark:text-white">Balancing Modes</h3>
        <div className="space-y-4 text-xs dark:text-gray-300">
          <p>
            <strong className="block text-blue-600 dark:text-blue-400">Stability (L/R):</strong>
            Balances weight equally between Left and Right sides.
          </p>
          <p>
            <strong className="block text-blue-600 dark:text-blue-400">Rocket (Engine):</strong>
            Places heaviest paddlers in the middle rows (Engine Room).
          </p>
          <p className="italic mt-2 border-t pt-2 dark:border-gray-700">
            * Rules: Paddlers must sit with a Volunteer. Linked groups are prioritized. Coach/Steer seats are locked.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 py-3 rounded text-sm font-bold mt-6 dark:text-white cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};
