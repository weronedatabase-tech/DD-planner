import React, { useState, useRef } from 'react';
import { Member, SessionSubTab } from '../types';
import { formatDisplayDate } from '../utils/date';

interface SessionViewProps {
  sessionSubTab: SessionSubTab;
  onSubTabChange: (tab: SessionSubTab) => void;
  currentSessionDate: string | null;
  savedSessions: { id: string; name: string }[];
  roster: Member[];
  attendance: string[]; // List of member names attending
  onAttendanceToggle: (memberName: string, isChecked: boolean) => void;
  onToggleGroup: (type: 'Paddler' | 'Volunteer', isChecked: boolean) => void;
  onCreateNewSession: (dateVal: string) => void;
  onLoadSession: (sessionId: string) => void;
}

export const SessionView: React.FC<SessionViewProps> = ({
  sessionSubTab,
  onSubTabChange,
  currentSessionDate,
  savedSessions,
  roster,
  attendance,
  onAttendanceToggle,
  onToggleGroup,
  onCreateNewSession,
  onLoadSession,
}) => {
  const [pickedDate, setPickedDate] = useState<string>('');
  const [selectedLoadId, setSelectedLoadId] = useState<string>('');
  const dateInputRef = useRef<HTMLInputElement>(null);

  const paddlers = roster.filter((m) => m.type === 'Paddler').sort((a, b) => a.name.localeCompare(b.name));
  const volunteers = roster.filter((m) => m.type === 'Volunteer').sort((a, b) => a.name.localeCompare(b.name));

  const allPaddlersChecked =
    paddlers.length > 0 && paddlers.every((p) => attendance.includes(p.name));
  const allVolunteersChecked =
    volunteers.length > 0 && volunteers.every((v) => attendance.includes(v.name));

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPickedDate(e.target.value);
  };

  const handleCreate = () => {
    if (!pickedDate) {
      alert('Please pick a date first.');
      return;
    }
    onCreateNewSession(pickedDate);
  };

  const handleLoad = () => {
    if (!selectedLoadId) return;
    onLoadSession(selectedLoadId);
  };

  return (
    <div id="view-session" className="h-full flex flex-col max-w-lg mx-auto w-full">
      <div className="flex-none p-2 pb-1">
        <div className="bg-surface-light dark:bg-surface-dark bg-white dark:bg-gray-800 rounded shadow border dark:border-gray-700 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b dark:border-gray-600">
            <button
              type="button"
              id="tab-new"
              onClick={() => onSubTabChange('new')}
              className={`flex-1 py-2 text-xs font-bold uppercase transition-colors cursor-pointer ${
                sessionSubTab === 'new'
                  ? 'bg-blue-600 dark:bg-blue-800 text-white border-blue-800'
                  : 'bg-gray-100 dark:bg-gray-900 text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              New Session
            </button>
            <button
              type="button"
              id="tab-load"
              onClick={() => onSubTabChange('load')}
              className={`flex-1 py-2 text-xs font-bold uppercase transition-colors cursor-pointer ${
                sessionSubTab === 'load'
                  ? 'bg-blue-600 dark:bg-blue-800 text-white border-blue-800'
                  : 'bg-gray-100 dark:bg-gray-900 text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Load Saved
            </button>
          </div>

          <div className="p-2">
            {sessionSubTab === 'new' ? (
              <div id="panel-new" className="block">
                <label className="block text-[10px] font-bold text-gray-500 uppercase dark:text-gray-300 mb-1">
                  Pick Date
                </label>
                <div className="flex gap-2 h-9">
                  <div className="relative flex-1 h-full">
                    <div
                      id="new-session-display"
                      onClick={() => {
                        try {
                          dateInputRef.current?.showPicker();
                        } catch {}
                      }}
                      className="w-full h-full border p-2 rounded dark:bg-gray-800 dark:border-gray-600 text-sm flex items-center dark:text-white truncate cursor-pointer"
                    >
                      {pickedDate ? (
                        formatDisplayDate(pickedDate)
                      ) : (
                        <span className="text-gray-400 italic">Select Date...</span>
                      )}
                    </div>
                    <input
                      ref={dateInputRef}
                      type="date"
                      id="new-session-date"
                      value={pickedDate}
                      onChange={handleDateChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="bg-blue-600 text-white px-3 rounded text-xs font-bold shadow hover:bg-blue-700 h-full cursor-pointer whitespace-nowrap"
                  >
                    CREATE & START
                  </button>
                </div>
              </div>
            ) : (
              <div id="panel-load" className="block">
                <label className="block text-[10px] font-bold text-gray-500 uppercase dark:text-gray-300 mb-1">
                  Select File
                </label>
                <div className="flex gap-2 h-9">
                  <select
                    id="load-select"
                    value={selectedLoadId}
                    onChange={(e) => setSelectedLoadId(e.target.value)}
                    className="flex-1 h-full border px-2 rounded dark:bg-gray-800 dark:border-gray-600 text-sm dark:text-white"
                  >
                    <option value="">
                      {savedSessions.length === 0 ? 'No files' : 'Select session...'}
                    </option>
                    {savedSessions.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleLoad}
                    className="bg-gray-700 text-white px-3 rounded text-xs font-bold shadow hover:bg-gray-600 h-full cursor-pointer"
                  >
                    LOAD
                  </button>
                </div>
              </div>
            )}
          </div>

          {currentSessionDate && (
            <div
              id="active-session-bar"
              className="bg-blue-50 dark:bg-gray-800 border-t dark:border-gray-600 p-1.5 text-center text-xs"
            >
              <span className="text-gray-500 uppercase font-bold mr-2">Active:</span>
              <span
                id="active-session-display"
                className="font-bold text-blue-700 dark:text-blue-400 text-sm"
              >
                {formatDisplayDate(currentSessionDate)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Attendance Section */}
      {currentSessionDate && (
        <div id="attendance-section" className="flex-grow flex flex-col p-2 pt-0 min-h-0">
          <div className="bg-surface-light dark:bg-surface-dark bg-white dark:bg-gray-800 rounded shadow border dark:border-gray-700 flex flex-col h-full overflow-hidden">
            <div className="flex text-xs font-bold uppercase">
              <div className="w-1/2 p-2 pl-3 bg-blue-100 text-blue-900 dark:bg-blue-800 dark:text-blue-100 border-b border-blue-200 dark:border-blue-700 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allPaddlersChecked}
                  onChange={(e) => onToggleGroup('Paddler', e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer"
                />
                <span>Paddlers</span>
              </div>
              <div className="w-1/2 p-2 pl-3 bg-green-100 text-green-900 dark:bg-green-800 dark:text-green-100 border-b border-green-200 dark:border-green-700 border-l dark:border-l-gray-600 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allVolunteersChecked}
                  onChange={(e) => onToggleGroup('Volunteer', e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer"
                />
                <span>Volunteers</span>
              </div>
            </div>

            <div className="flex-grow flex overflow-hidden">
              <div
                id="list-paddlers"
                className="w-1/2 overflow-y-auto p-1 custom-scroll border-r dark:border-gray-600 pb-24"
              >
                {paddlers.map((p) => {
                  const isChecked = attendance.includes(p.name);
                  return (
                    <label
                      key={p.name}
                      className="flex items-center space-x-3 p-3 rounded cursor-pointer text-xs border-b dark:border-gray-700 bg-[#bfdbfe] dark:bg-blue-900 text-[#1e3a8a] mb-1"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => onAttendanceToggle(p.name, e.target.checked)}
                        className="att-chk w-4 h-4"
                      />
                      <span className="truncate font-bold dark:text-gray-100">{p.name}</span>
                    </label>
                  );
                })}
              </div>

              <div
                id="list-volunteers"
                className="w-1/2 overflow-y-auto p-1 custom-scroll pb-24"
              >
                {volunteers.map((p) => {
                  const isChecked = attendance.includes(p.name);
                  return (
                    <label
                      key={p.name}
                      className="flex items-center space-x-3 p-3 rounded cursor-pointer text-xs border-b dark:border-gray-700 bg-[#bbf7d0] dark:bg-green-900 text-[#14532d] mb-1"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => onAttendanceToggle(p.name, e.target.checked)}
                        className="att-chk w-4 h-4"
                      />
                      <span className="truncate font-bold dark:text-gray-100">{p.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
