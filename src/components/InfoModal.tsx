import React from 'react';
import { Scale, Zap, ShieldCheck, X } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[90] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-extrabold text-base sm:text-lg text-zinc-950 dark:text-white">
            Auto-Balancing Algorithms
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-700 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-zinc-800 dark:text-zinc-100 leading-relaxed">
          <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-[#14141b] border border-zinc-300 dark:border-zinc-700">
            <div className="flex items-center gap-2 font-bold text-zinc-950 dark:text-white mb-1">
              <Scale className="w-4 h-4 text-sky-500" />
              <span>Stability (L/R Port & Starboard)</span>
            </div>
            <p className="text-zinc-700 dark:text-zinc-200 font-medium">
              Distributes combined pair weights sequentially from bow to stern while minimizing the
              lateral weight delta between Left (Port) and Right (Starboard) benches.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-[#14141b] border border-zinc-300 dark:border-zinc-700">
            <div className="flex items-center gap-2 font-bold text-zinc-950 dark:text-white mb-1">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Rocket (Engine Room Concentration)</span>
            </div>
            <p className="text-zinc-700 dark:text-zinc-200 font-medium">
              Concentrates the heaviest, highest-output pairs into the widest middle rows (the
              Engine Room) and tapers lighter pairs toward the bow and stern for optimal hull lift.
            </p>
          </div>

          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-start gap-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              Pairing Rules: Paddlers are paired with their explicitly linked Volunteers first, then
              with side-compatible Volunteers. Odd rows place Paddlers on Left; even rows place
              Paddlers on Right. Coach/Drum and Steer seats remain locked.
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white py-2.5 rounded-lg text-xs sm:text-sm font-bold mt-5 transition-colors cursor-pointer"
        >
          Got It
        </button>
      </div>
    </div>
  );
};
