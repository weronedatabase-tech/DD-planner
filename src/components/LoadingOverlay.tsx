import React from 'react';

interface LoadingOverlayProps {
  isLoading: boolean;
  message: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading, message }) => {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center">
      <div className="spinner mb-4" />
      <div className="text-white font-bold text-lg tracking-wider">{message || 'Loading...'}</div>
    </div>
  );
};
