import React from 'react';
import { Member, BoatSeat } from '../types';

interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  seat: BoatSeat | null;
  boatId: string | null;
  attendingMembers: Member[];
  seatedNames: Set<string>;
  onAssign: (memberName: string) => void;
  onClearSeat: () => void;
}

export const AssignModal: React.FC<AssignModalProps> = ({
  isOpen,
  onClose,
  seat,
  attendingMembers,
  seatedNames,
  onAssign,
  onClearSeat,
}) => {
  if (!isOpen || !seat) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-light dark:bg-surface-dark bg-white dark:bg-gray-800 p-4 rounded-lg w-11/12 max-w-sm h-3/4 flex flex-col shadow-2xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold dark:text-white text-base">Select Person</h3>
          <div className="flex items-center gap-2">
            {seat.occupant && (
              <button
                type="button"
                onClick={() => {
                  onClearSeat();
                  onClose();
                }}
                className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded cursor-pointer"
              >
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-2xl px-2 leading-none text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white cursor-pointer"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 space-y-1 custom-scroll dark:text-gray-100 pb-4">
          {attendingMembers.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400">
              No attendees in current session. Mark attendance in the Session tab first.
            </div>
          ) : (
            attendingMembers.map((p) => {
              const isSeated = seatedNames.has(p.name);
              const status = isSeated ? 'Seated' : 'In Pool';
              const typeClass =
                p.type === 'Volunteer'
                  ? 'bg-[#bbf7d0] text-[#14532d] dark:bg-green-900 dark:text-green-100 border-green-200 dark:border-green-700'
                  : 'bg-[#bae6fd] text-[#0c4a6e] dark:bg-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-700';

              return (
                <div
                  key={p.name}
                  onClick={() => {
                    onAssign(p.name);
                    onClose();
                  }}
                  className={`p-3 border-b rounded flex justify-between items-center cursor-pointer hover:opacity-85 ${typeClass}`}
                >
                  <span className="font-semibold text-xs">{p.name}</span>
                  <span className="text-[10px] font-bold opacity-75">{status}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
