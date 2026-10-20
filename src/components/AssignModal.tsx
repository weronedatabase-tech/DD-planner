import React, { useState, useMemo } from 'react';
import { Member, BoatSeat } from '../types';
import { Search, UserMinus, X } from 'lucide-react';

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
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'pool' | 'Paddler' | 'Volunteer'>('all');

  const filteredAttendees = useMemo(() => {
    return attendingMembers
      .filter((m) => {
        if (search.trim() && !m.name.toLowerCase().includes(search.toLowerCase())) {
          return false;
        }
        if (filterMode === 'pool' && seatedNames.has(m.name)) return false;
        if (filterMode === 'Paddler' && m.type !== 'Paddler') return false;
        if (filterMode === 'Volunteer' && m.type !== 'Volunteer') return false;
        return true;
      })
      .sort((a, b) => {
        const aSeated = seatedNames.has(a.name) ? 1 : 0;
        const bSeated = seatedNames.has(b.name) ? 1 : 0;
        if (aSeated !== bSeated) return aSeated - bSeated;
        return a.name.localeCompare(b.name);
      });
  }, [attendingMembers, search, filterMode, seatedNames]);

  if (!isOpen || !seat) return null;

  const seatLabel =
    seat.role === 'drummer'
      ? 'Coach / Drum Seat'
      : seat.role === 'helm'
      ? 'Steer / Helm Seat'
      : `Row ${seat.row} · ${seat.side} Bench`;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[80] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl w-full max-w-md max-h-[82vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-3 mb-3">
          <div>
            <h3 className="font-display font-extrabold text-base sm:text-lg text-zinc-950 dark:text-white">
              Assign Seat
            </h3>
            <p className="text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-200 font-mono mt-0.5">
              {seatLabel}
              {seat.occupant ? ` · Currently: ${seat.occupant}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {seat.occupant && (
              <button
                type="button"
                onClick={() => {
                  onClearSeat();
                  onClose();
                }}
                className="flex items-center gap-1.5 text-xs font-bold bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>Clear Seat</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-700 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Segmented Filter */}
        <div className="space-y-2 mb-3">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 dark:text-zinc-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search attendee name..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-[#14141b] text-zinc-950 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-[#14141b] border border-zinc-300 dark:border-zinc-700">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'pool', label: 'In Pool' },
                { id: 'Paddler', label: 'Paddlers' },
                { id: 'Volunteer', label: 'Volunteers' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`flex-1 py-1.5 px-2 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  filterMode === tab.id
                    ? 'bg-sky-600 dark:bg-sky-500 text-white dark:text-zinc-950 shadow-2xs'
                    : 'text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 space-y-1.5 custom-scroll pr-0.5">
          {attendingMembers.length === 0 ? (
            <div className="p-8 text-center text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300">
              No attendees in the current session. Mark attendance in the Session tab first.
            </div>
          ) : filteredAttendees.length === 0 ? (
            <div className="p-8 text-center text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300">
              No attendees match your filter.
            </div>
          ) : (
            filteredAttendees.map((p) => {
              const isSeated = seatedNames.has(p.name);
              const isCurrentOccupant = seat.occupant === p.name;
              const status = isCurrentOccupant
                ? 'Current Seat'
                : isSeated
                ? 'Seated (Move)'
                : 'In Pool';

              const roleSurface =
                p.type === 'Volunteer'
                  ? 'row-volunteer'
                  : 'row-paddler';

              return (
                <button
                  type="button"
                  key={p.name}
                  onClick={() => {
                    onAssign(p.name);
                    onClose();
                  }}
                  className={`w-full p-2.5 rounded-lg flex justify-between items-start sm:items-center gap-2 text-left cursor-pointer transition-opacity hover:opacity-95 ${roleSurface} ${
                    isSeated && !isCurrentOccupant ? 'opacity-75' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs sm:text-sm break-words leading-snug">
                      {p.name}
                    </div>
                    <div className="text-xs font-semibold opacity-95 font-mono tabular-nums mt-0.5 break-words">
                      {p.type} · {p.weight}kg · {p.side} Side
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold shrink-0">{status}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
