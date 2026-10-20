import React, { useState, useRef, useMemo } from 'react';
import { Member, SessionSubTab, SavedSessionSummary } from '../types';
import { formatDisplayDate } from '../utils/date';
import { Calendar, FolderOpen, Search, ArrowRight } from 'lucide-react';

interface SessionViewProps {
  sessionSubTab: SessionSubTab;
  onSubTabChange: (tab: SessionSubTab) => void;
  currentSessionDate: string | null;
  savedSessions: SavedSessionSummary[];
  roster: Member[];
  attendance: string[];
  onAttendanceToggle: (memberName: string, isChecked: boolean) => void;
  onToggleGroup: (type: 'Paddler' | 'Volunteer', isChecked: boolean) => void;
  onCreateNewSession: (dateVal: string) => void;
  onLoadSession: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onGoToBoats?: () => void;
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
  onGoToBoats,
}) => {
  const [pickedDate, setPickedDate] = useState<string>('');
  const [selectedLoadId, setSelectedLoadId] = useState<string>('');
  const [attendanceSearch, setAttendanceSearch] = useState<string>('');
  const [dateWarning, setDateWarning] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const paddlers = useMemo(
    () =>
      roster
        .filter(
          (m) =>
            m.type === 'Paddler' &&
            (!attendanceSearch.trim() ||
              m.name.toLowerCase().includes(attendanceSearch.toLowerCase()))
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [roster, attendanceSearch]
  );

  const volunteers = useMemo(
    () =>
      roster
        .filter(
          (m) =>
            m.type === 'Volunteer' &&
            (!attendanceSearch.trim() ||
              m.name.toLowerCase().includes(attendanceSearch.toLowerCase()))
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [roster, attendanceSearch]
  );

  const allRosterPaddlers = roster.filter((m) => m.type === 'Paddler');
  const allRosterVolunteers = roster.filter((m) => m.type === 'Volunteer');

  const allPaddlersChecked =
    allRosterPaddlers.length > 0 && allRosterPaddlers.every((p) => attendance.includes(p.name));
  const allVolunteersChecked =
    allRosterVolunteers.length > 0 &&
    allRosterVolunteers.every((v) => attendance.includes(v.name));

  const attendingPaddlersCount = allRosterPaddlers.filter((p) =>
    attendance.includes(p.name)
  ).length;
  const attendingVolunteersCount = allRosterVolunteers.filter((v) =>
    attendance.includes(v.name)
  ).length;

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPickedDate(e.target.value);
    if (dateWarning) setDateWarning(null);
  };

  const handleCreate = () => {
    if (!pickedDate) {
      setDateWarning('Please select a session date first.');
      return;
    }
    setDateWarning(null);
    onCreateNewSession(pickedDate);
  };

  const handleLoad = () => {
    if (!selectedLoadId) return;
    onLoadSession(selectedLoadId);
  };

  return (
    <div
      id="view-session"
      className="h-full flex flex-col max-w-4xl mx-auto w-full p-2.5 sm:p-5 gap-2.5 sm:gap-3 overflow-hidden"
    >
      {/* Top Session Control Card (New Session Date Picker / Load Saved Dropdown) */}
      <div className="bg-white dark:bg-[#09090b] rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex-none">
        {/* Segmented Mode Tabs */}
        <div className="flex p-1 sm:p-1.5 bg-zinc-100 dark:bg-[#0e0e13] border-b border-zinc-200 dark:border-zinc-800 gap-1 sm:gap-1.5">
          <button
            type="button"
            id="tab-new"
            onClick={() => onSubTabChange('new')}
            className={`flex-1 py-2 sm:py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
              sessionSubTab === 'new'
                ? 'bg-sky-600 dark:bg-sky-500 text-white dark:text-zinc-950 shadow-xs'
                : 'text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
            }`}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span>New Session</span>
          </button>
          <button
            type="button"
            id="tab-load"
            onClick={() => onSubTabChange('load')}
            className={`flex-1 py-2 sm:py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
              sessionSubTab === 'load'
                ? 'bg-sky-600 dark:bg-sky-500 text-white dark:text-zinc-950 shadow-xs'
                : 'text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
            }`}
          >
            <FolderOpen className="w-4 h-4 shrink-0" />
            <span>Load Saved</span>
          </button>
        </div>

        <div className="p-3 sm:p-4">
          {sessionSubTab === 'new' ? (
            <div id="panel-new">
              <label className="block text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-1.5">
                Pick Date
              </label>
              <div className="flex gap-2 sm:gap-2.5 h-10 sm:h-11">
                <div className="relative flex-1 h-full">
                  <div
                    id="new-session-display"
                    onClick={() => {
                      try {
                        dateInputRef.current?.showPicker();
                      } catch {}
                    }}
                    className="w-full h-full border border-zinc-300 dark:border-zinc-700 px-3 sm:px-3.5 rounded-lg bg-zinc-50 dark:bg-[#14141b] text-sm sm:text-base font-mono font-bold tabular-nums flex items-center justify-between text-zinc-950 dark:text-white truncate cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
                  >
                    <span>
                      {pickedDate ? (
                        formatDisplayDate(pickedDate)
                      ) : (
                        <span className="text-zinc-500 dark:text-zinc-300 font-sans">
                          Select Date...
                        </span>
                      )}
                    </span>
                    <Calendar className="w-4 h-4 text-zinc-600 dark:text-zinc-300 shrink-0 ml-2" />
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
                  className="bg-sky-600 hover:bg-sky-500 text-white px-3.5 sm:px-5 rounded-lg text-xs sm:text-sm font-bold transition-colors h-full cursor-pointer whitespace-nowrap shrink-0"
                >
                  Create & Start
                </button>
              </div>
              {dateWarning && (
                <p className="text-xs sm:text-sm font-semibold text-red-500 mt-1.5">
                  {dateWarning}
                </p>
              )}
            </div>
          ) : (
            <div id="panel-load">
              <label className="block text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-1.5">
                Select Saved Session
              </label>
              <div className="flex gap-2 sm:gap-2.5 h-10 sm:h-11">
                <select
                  id="load-select"
                  value={selectedLoadId}
                  onChange={(e) => setSelectedLoadId(e.target.value)}
                  className="flex-1 h-full border border-zinc-300 dark:border-zinc-700 px-3 sm:px-3.5 rounded-lg bg-zinc-50 dark:bg-[#14141b] text-sm sm:text-base font-mono font-bold text-zinc-950 dark:text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="">
                    {savedSessions.length === 0 ? 'No saved sessions' : 'Select session...'}
                  </option>
                  {savedSessions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {formatDisplayDate(f.rawDate || f.id) || f.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleLoad}
                  disabled={!selectedLoadId}
                  className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white px-4 sm:px-5 rounded-lg text-xs sm:text-sm font-bold transition-colors h-full cursor-pointer whitespace-nowrap shrink-0"
                >
                  Load
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          id="active-session-bar"
          className="bg-zinc-100 dark:bg-[#111116] border-t border-zinc-200 dark:border-zinc-800 px-3 sm:px-4 py-2 flex items-center justify-between text-xs sm:text-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-zinc-700 dark:text-zinc-200 font-bold">Active Session:</span>
            <span
              id="active-session-display"
              className="font-mono font-bold text-sky-700 dark:text-sky-300 truncate"
            >
              {currentSessionDate ? formatDisplayDate(currentSessionDate) : ''}
            </span>
          </div>
          {currentSessionDate && onGoToBoats && (
            <button
              type="button"
              onClick={onGoToBoats}
              className="text-xs sm:text-sm font-bold text-sky-700 dark:text-sky-300 hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Plan Boats</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Attendance Section: Volunteers and Paddlers */}
      {currentSessionDate ? (
        <div
          id="attendance-section"
          className="bg-white dark:bg-[#09090b] rounded-xl border border-zinc-200 dark:border-zinc-800 flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          {/* Attendance Header & Search */}
          <div className="px-3 sm:px-3.5 py-2 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-zinc-50 dark:bg-[#0e0e13]">
            <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-200 font-mono font-bold tabular-nums">
              <span className="font-sans font-extrabold text-zinc-950 dark:text-white">
                Attendance
              </span>
              <span aria-hidden="true">·</span>
              <span>{attendance.length} Present</span>
              <span aria-hidden="true">·</span>
              <span className="text-sky-700 dark:text-sky-300">
                {attendingPaddlersCount} P
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 dark:text-emerald-300">
                {attendingVolunteersCount} V
              </span>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-500 dark:text-zinc-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={attendanceSearch}
                onChange={(e) => setAttendanceSearch(e.target.value)}
                placeholder="Search Paddlers & Volunteers..."
                className="w-full pl-8 sm:pl-9 pr-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#14141b] text-zinc-950 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Group Select Bar */}
          <div className="grid grid-cols-2 text-xs sm:text-sm font-bold border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-[#111116]">
            <label className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 flex items-center justify-between cursor-pointer border-r border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allPaddlersChecked}
                  onChange={(e) => onToggleGroup('Paddler', e.target.checked)}
                  className="w-4 h-4 rounded accent-sky-500 cursor-pointer shrink-0"
                />
                <span className="text-sky-900 dark:text-sky-200">Paddlers</span>
              </div>
              <span className="font-mono text-xs sm:text-sm text-zinc-700 dark:text-zinc-200 tabular-nums">
                {attendingPaddlersCount}/{allRosterPaddlers.length}
              </span>
            </label>

            <label className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 flex items-center justify-between cursor-pointer hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allVolunteersChecked}
                  onChange={(e) => onToggleGroup('Volunteer', e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-500 cursor-pointer shrink-0"
                />
                <span className="text-emerald-900 dark:text-emerald-200">Volunteers</span>
              </div>
              <span className="font-mono text-xs sm:text-sm text-zinc-700 dark:text-zinc-200 tabular-nums">
                {attendingVolunteersCount}/{allRosterVolunteers.length}
              </span>
            </label>
          </div>

          {/* Two-Column Checklists (Single Checkbox Per Member) */}
          <div className="flex-grow grid grid-cols-2 overflow-hidden min-h-0">
            <div
              id="list-paddlers"
              className="overflow-y-auto p-1.5 sm:p-2 space-y-1.5 custom-scroll border-r border-zinc-200 dark:border-zinc-800 pb-20"
            >
              {paddlers.map((p) => {
                const isChecked = attendance.includes(p.name);
                return (
                  <label
                    key={p.name}
                    className={`flex items-center px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg cursor-pointer transition-all row-paddler ${
                      isChecked
                        ? 'ring-2 ring-sky-500 dark:ring-sky-400'
                        : 'hover:brightness-95 dark:hover:brightness-110'
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 w-full">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => onAttendanceToggle(p.name, e.target.checked)}
                        className="att-chk w-4 h-4 rounded accent-sky-500 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold text-xs sm:text-sm">{p.name}</div>
                        <div className="text-[11px] sm:text-xs font-semibold font-mono tabular-nums opacity-95">
                          {p.weight}kg · {p.side}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div
              id="list-volunteers"
              className="overflow-y-auto p-1.5 sm:p-2 space-y-1.5 custom-scroll pb-20"
            >
              {volunteers.map((p) => {
                const isChecked = attendance.includes(p.name);
                return (
                  <label
                    key={p.name}
                    className={`flex items-center px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg cursor-pointer transition-all row-volunteer ${
                      isChecked
                        ? 'ring-2 ring-emerald-500 dark:ring-emerald-400'
                        : 'hover:brightness-95 dark:hover:brightness-110'
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 w-full">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => onAttendanceToggle(p.name, e.target.checked)}
                        className="att-chk w-4 h-4 rounded accent-emerald-500 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold text-xs sm:text-sm">{p.name}</div>
                        <div className="text-[11px] sm:text-xs font-semibold font-mono tabular-nums opacity-95">
                          {p.weight}kg · {p.side}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#09090b] rounded-xl border border-zinc-200 dark:border-zinc-800 flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center">
          <Calendar className="w-10 h-10 text-zinc-500 dark:text-zinc-400 mb-3 stroke-[1.5]" />
          <h3 className="font-display font-bold text-base sm:text-lg text-zinc-950 dark:text-white mb-1">
            No Active Session Selected
          </h3>
          <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 max-w-sm leading-relaxed mb-4">
            Pick a date above and press Create & Start, or switch to Load Saved to select a session
            from the dropdown list.
          </p>
        </div>
      )}
    </div>
  );
};
