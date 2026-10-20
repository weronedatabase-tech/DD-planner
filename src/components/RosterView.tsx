import React from 'react';
import { Member } from '../types';

interface RosterViewProps {
  roster: Member[];
  onAddMember: () => void;
  onEditMember: (member: Member) => void;
  onDeleteMember: (member: Member) => void;
}

export const RosterView: React.FC<RosterViewProps> = ({
  roster,
  onAddMember,
  onEditMember,
  onDeleteMember,
}) => {
  const paddlers = roster.filter((m) => m.type === 'Paddler').sort((a, b) => a.name.localeCompare(b.name));
  const volunteers = roster.filter((m) => m.type === 'Volunteer').sort((a, b) => a.name.localeCompare(b.name));

  const trashIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );

  return (
    <div id="view-roster" className="p-2 h-full flex flex-col w-full max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-2 flex-none px-1">
        <h2 className="text-xl font-bold dark:text-white">Team Roster</h2>
        <button
          type="button"
          onClick={onAddMember}
          className="bg-blue-600 text-white px-3 py-1 rounded shadow hover:bg-blue-700 font-bold text-sm cursor-pointer"
        >
          + Add
        </button>
      </div>

      <div className="flex-grow flex flex-row gap-2 min-h-0">
        {/* Paddlers Column */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-800 rounded shadow border dark:border-gray-700 overflow-hidden">
          <div className="p-2 bg-blue-100 dark:bg-blue-800 border-b border-blue-200 dark:border-blue-700 font-bold text-center text-blue-900 dark:text-blue-100 uppercase text-xs sticky top-0 z-10">
            Paddlers ({paddlers.length})
          </div>
          <div className="overflow-y-auto p-1 space-y-1 custom-scroll flex-grow pb-24">
            {paddlers.map((p) => (
              <div
                key={p.name}
                className="p-2 rounded shadow flex justify-between items-center border dark:border-gray-700 row-paddler"
              >
                <div>
                  <div className="font-bold text-sm truncate w-24 sm:w-48" title={p.name}>
                    {p.name}
                  </div>
                  <div className="text-[10px] opacity-80 truncate w-24 sm:w-48">
                    {p.weight}kg | {p.side}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => onEditMember(p)}
                    className="text-amber-600 dark:text-amber-400 font-bold text-xs hover:text-amber-800 dark:hover:text-amber-300 cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteMember(p)}
                    className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                    title="Delete Member"
                  >
                    {trashIcon}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Volunteers Column */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-800 rounded shadow border dark:border-gray-700 overflow-hidden">
          <div className="p-2 bg-green-100 dark:bg-green-800 border-b border-green-200 dark:border-green-700 font-bold text-center text-green-900 dark:text-green-100 uppercase text-xs sticky top-0 z-10">
            Volunteers ({volunteers.length})
          </div>
          <div className="overflow-y-auto p-1 space-y-1 custom-scroll flex-grow pb-24">
            {volunteers.map((p) => (
              <div
                key={p.name}
                className="p-2 rounded shadow flex justify-between items-center border dark:border-gray-700 row-volunteer"
              >
                <div>
                  <div className="font-bold text-sm truncate w-24 sm:w-48" title={p.name}>
                    {p.name}
                  </div>
                  <div className="text-[10px] opacity-80 truncate w-24 sm:w-48">
                    {p.weight}kg | {p.side}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => onEditMember(p)}
                    className="text-amber-600 dark:text-amber-400 font-bold text-xs hover:text-amber-800 dark:hover:text-amber-300 cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteMember(p)}
                    className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                    title="Delete Member"
                  >
                    {trashIcon}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
