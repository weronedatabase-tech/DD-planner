import React from 'react';

interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  driveUrl: string;
}

export const LinkModal: React.FC<LinkModalProps> = ({ isOpen, onClose, driveUrl }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-sm shadow-xl text-center">
        <div className="text-green-500 mb-2 text-4xl">✓</div>
        <h3 className="font-bold text-lg mb-2 dark:text-white">Image Uploaded</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          The boat configuration has been saved to Google Drive.
        </p>
        <a
          href={driveUrl}
          target="_blank"
          rel="noreferrer"
          className="block w-full bg-blue-600 text-white py-2 rounded font-bold mb-3 hover:bg-blue-700 truncate px-2 text-sm no-underline"
        >
          Open Image
        </a>
        <button
          type="button"
          onClick={onClose}
          className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 py-2 rounded text-sm font-bold dark:text-white cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};
