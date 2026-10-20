import React from 'react';
import { Trash2 } from 'lucide-react';

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
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[80] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-300 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-base sm:text-lg text-zinc-950 dark:text-white">
              Delete Member
            </h3>
            <p className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-200 mt-1 leading-relaxed">
              Remove{' '}
              <span className="font-bold text-zinc-950 dark:text-white">{memberName}</span>{' '}
              from the Google Sheet roster and active boat seats? This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2.5 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs sm:text-sm font-bold text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
          >
            Delete Member
          </button>
        </div>
      </div>
    </div>
  );
};
