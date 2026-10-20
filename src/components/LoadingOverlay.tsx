import React from 'react';

interface LoadingOverlayProps {
  isLoading: boolean;
  message: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading, message }) => {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[100] flex flex-col items-center justify-center p-4">
      <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-6 py-5 flex items-center gap-4 shadow-2xl">
        <div className="spinner shrink-0" />
        <div>
          <div className="text-zinc-950 dark:text-white font-display font-bold text-sm sm:text-base">
            {message || 'Syncing with Google Sheet...'}
          </div>
          <div className="text-xs font-medium text-zinc-700 dark:text-zinc-200 mt-0.5">
            Keeping all collaborators synchronized
          </div>
        </div>
      </div>
    </div>
  );
};
