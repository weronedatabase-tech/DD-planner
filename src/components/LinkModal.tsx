import React from 'react';
import { CheckCircle2, Download, ExternalLink, Share2, X } from 'lucide-react';
import { dataUrlToImageFile } from '../utils/canvas';

interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  driveUrl: string;
  dataUrl?: string;
  filename?: string;
}

export const LinkModal: React.FC<LinkModalProps> = ({
  isOpen,
  onClose,
  driveUrl,
  dataUrl,
  filename = 'boat_lineup.jpg',
}) => {
  if (!isOpen) return null;

  const isDataUrl = driveUrl.startsWith('data:');
  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function' && Boolean(dataUrl);

  const handleNativeShare = async () => {
    if (!dataUrl || typeof navigator === 'undefined' || !navigator.share) return;
    try {
      const file = dataUrlToImageFile(dataUrl, filename);
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename.replace(/\.jpg$/i, ''),
        });
      }
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[80] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h3 className="font-display font-extrabold text-base sm:text-lg text-zinc-950 dark:text-white">
              Share Boat Lineup
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-700 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {(dataUrl || isDataUrl) && (
          <div className="mb-4 rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-black max-h-64 flex items-center justify-center">
            <img
              src={dataUrl || driveUrl}
              alt="Boat Lineup Preview"
              referrerPolicy="no-referrer"
              className="max-h-60 w-auto object-contain"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          {canNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="flex items-center justify-center gap-2 w-full bg-sky-600 hover:bg-sky-500 text-white py-2.5 px-4 rounded-lg font-bold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share to Other Apps</span>
            </button>
          )}

          {(dataUrl || isDataUrl) && (
            <a
              href={dataUrl || driveUrl}
              download={filename}
              className="flex items-center justify-center gap-2 w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white py-2.5 px-4 rounded-lg font-bold text-xs sm:text-sm transition-colors no-underline"
            >
              <Download className="w-4 h-4" />
              <span>Download Image ({filename})</span>
            </a>
          )}

          {!isDataUrl && (
            <a
              href={driveUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-950 dark:text-white py-2.5 px-4 rounded-lg font-bold text-xs sm:text-sm transition-colors no-underline"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in Google Drive</span>
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-lg text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
