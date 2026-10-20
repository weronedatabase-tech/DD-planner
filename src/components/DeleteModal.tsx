import React from 'react';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  memberName: string;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  memberName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-sm shadow-xl">
        <h3 className="font-bold text-lg mb-2 dark:text-white">Delete Member</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          Are you sure you want to remove <span className="font-bold text-gray-900 dark:text-white">{memberName}</span>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 cursor-pointer text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 font-bold shadow cursor-pointer text-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
