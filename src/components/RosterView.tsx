import React, { useState, useMemo } from 'react';
import { Member } from '../types';
import { Plus, Search, Pencil, Trash2, ArrowUpDown } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [sideFilter, setSideFilter] = useState<'All' | 'Left' | 'Right' | 'Any'>('All');
  const [sortBy, setSortBy] = useState<'name' | 'weight-desc' | 'weight-asc'>('name');
  const [mobileRoleTab, setMobileRoleTab] = useState<'Paddler' | 'Volunteer'>('Paddler');

  const filterAndSort = useMemo(() => {
    const fn = (list: Member[]) => {
      return list
        .filter((m) => {
          if (
            searchQuery.trim() &&
            !m.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !(m.volunteers || '').toLowerCase().includes(searchQuery.toLowerCase())
          ) {
            return false;
          }
          if (sideFilter !== 'All' && m.side !== sideFilter) {
            return false;
          }
          return true;
        })
        .sort((a, b) => {
          if (sortBy === 'weight-desc') return (b.weight || 0) - (a.weight || 0);
          if (sortBy === 'weight-asc') return (a.weight || 0) - (b.weight || 0);
          return a.name.localeCompare(b.name);
        });
    };
    return {
      paddlers: fn(roster.filter((m) => m.type === 'Paddler')),
      volunteers: fn(roster.filter((m) => m.type === 'Volunteer')),
    };
  }, [roster, searchQuery, sideFilter, sortBy]);

  const totalPaddlers = roster.filter((m) => m.type === 'Paddler').length;
  const totalVolunteers = roster.filter((m) => m.type === 'Volunteer').length;

  const renderMemberRow = (p: Member) => {
    const linkedList = p.volunteers
      ? p.volunteers
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    return (
      <div
        key={`${p.name}-${p.rowIndex || ''}`}
        className={`px-3 sm:px-3.5 py-2.5 rounded-lg flex justify-between items-center transition-colors ${
          p.type === 'Volunteer' ? 'row-volunteer' : 'row-paddler'
        }`}
      >
        <div className="min-w-0 pr-2.5">
          <div className="font-bold text-sm sm:text-base truncate" title={p.name}>
            {p.name}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm font-semibold opacity-95 font-mono tabular-nums mt-0.5">
            <span>{p.weight || 0} kg</span>
            <span aria-hidden="true">·</span>
            <span>{p.side || 'Any'} Side</span>
            <span aria-hidden="true">·</span>
            <span>{p.gender || 'M'}</span>
            {linkedList.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span
                  className="font-sans font-bold truncate max-w-[160px] sm:max-w-[260px]"
                  title={`Linked: ${linkedList.join(', ')}`}
                >
                  Linked: {linkedList.join(', ')}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onEditMember(p)}
            className="px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-bold bg-white/80 dark:bg-black/60 hover:bg-white dark:hover:bg-black text-zinc-950 dark:text-white border border-black/15 dark:border-white/20 transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={() => onDeleteMember(p)}
            className="p-1.5 rounded-md bg-white/80 dark:bg-black/60 hover:bg-red-500/25 text-red-700 dark:text-red-300 border border-black/15 dark:border-white/20 transition-colors cursor-pointer"
            title="Delete Member"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      id="view-roster"
      className="p-2.5 sm:p-5 h-full flex flex-col w-full max-w-[1440px] mx-auto gap-2.5 sm:gap-3"
    >
      {/* Top Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3 flex-none bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 sm:p-3.5">
        <div className="flex items-center justify-between lg:justify-start gap-3">
          <div>
            <h2 className="font-display text-base sm:text-xl font-extrabold text-zinc-950 dark:text-white leading-tight">
              Team Roster
            </h2>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-200 font-mono tabular-nums mt-0.5">
              <span>{roster.length} Total</span>
              <span aria-hidden="true">·</span>
              <span className="text-sky-700 dark:text-sky-300">{totalPaddlers} Paddlers</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 dark:text-emerald-300">
                {totalVolunteers} Volunteers
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onAddMember}
            className="lg:hidden bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Search input */}
          <div className="relative flex-1 sm:w-64 min-w-[150px]">
            <Search className="w-4 h-4 text-zinc-500 dark:text-zinc-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or partner..."
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-[#14141b] text-zinc-950 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Side Filter Segmented Control */}
          <div className="flex items-center gap-0.5 p-0.5 sm:p-1 rounded-lg bg-zinc-100 dark:bg-[#14141b] border border-zinc-300 dark:border-zinc-700">
            {(['All', 'Left', 'Right', 'Any'] as const).map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => setSideFilter(side)}
                className={`px-2 sm:px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  sideFilter === side
                    ? 'bg-sky-600 dark:bg-sky-500 text-white dark:text-zinc-950 shadow-2xs'
                    : 'text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                {side}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="relative flex items-center">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-300 absolute left-2.5 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="pl-7 sm:pl-8 pr-2.5 sm:pr-3 py-1.5 text-xs sm:text-sm font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-[#14141b] text-zinc-950 dark:text-white focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="name">Name (A–Z)</option>
              <option value="weight-desc">Weight (High–Low)</option>
              <option value="weight-asc">Weight (Low–High)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onAddMember}
            className="hidden lg:flex bg-sky-600 hover:bg-sky-500 text-white px-4 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition-colors cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Member</span>
          </button>
        </div>
      </div>

      {/* Mobile Role Switcher (< md) so mobile users get full-screen scrolling */}
      <div className="flex md:hidden p-1 rounded-xl bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 gap-1.5 flex-none">
        <button
          type="button"
          onClick={() => setMobileRoleTab('Paddler')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileRoleTab === 'Paddler'
              ? 'bg-sky-600 dark:bg-sky-500 text-white dark:text-zinc-950'
              : 'text-zinc-700 dark:text-zinc-200'
          }`}
        >
          <span>Paddlers</span>
          <span className="font-mono tabular-nums">
            ({filterAndSort.paddlers.length}/{totalPaddlers})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileRoleTab('Volunteer')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileRoleTab === 'Volunteer'
              ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-zinc-950'
              : 'text-zinc-700 dark:text-zinc-200'
          }`}
        >
          <span>Volunteers</span>
          <span className="font-mono tabular-nums">
            ({filterAndSort.volunteers.length}/{totalVolunteers})
          </span>
        </button>
      </div>

      {/* Two-Column Grid on Desktop / Full-Height Tabbed Column on Mobile */}
      <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0">
        {/* Paddlers Column */}
        <div
          className={`${
            mobileRoleTab === 'Paddler' ? 'flex' : 'hidden md:flex'
          } flex-col min-w-0 min-h-0 bg-white dark:bg-[#09090b] rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden`}
        >
          <div className="hidden md:flex px-4 py-2.5 bg-zinc-100 dark:bg-[#111116] border-b border-zinc-200 dark:border-zinc-800 items-center justify-between sticky top-0 z-10">
            <span className="font-display font-bold text-xs sm:text-sm text-sky-800 dark:text-sky-200">
              Paddlers
            </span>
            <span className="font-mono text-xs sm:text-sm font-bold tabular-nums text-zinc-700 dark:text-zinc-200">
              {filterAndSort.paddlers.length} / {totalPaddlers}
            </span>
          </div>
          <div className="overflow-y-auto p-2 sm:p-2.5 space-y-1.5 custom-scroll flex-grow pb-20">
            {filterAndSort.paddlers.length === 0 ? (
              <div className="py-12 text-center text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                No paddlers match the current filter.
              </div>
            ) : (
              filterAndSort.paddlers.map(renderMemberRow)
            )}
          </div>
        </div>

        {/* Volunteers Column */}
        <div
          className={`${
            mobileRoleTab === 'Volunteer' ? 'flex' : 'hidden md:flex'
          } flex-col min-w-0 min-h-0 bg-white dark:bg-[#09090b] rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden`}
        >
          <div className="hidden md:flex px-4 py-2.5 bg-zinc-100 dark:bg-[#111116] border-b border-zinc-200 dark:border-zinc-800 items-center justify-between sticky top-0 z-10">
            <span className="font-display font-bold text-xs sm:text-sm text-emerald-800 dark:text-emerald-200">
              Volunteers
            </span>
            <span className="font-mono text-xs sm:text-sm font-bold tabular-nums text-zinc-700 dark:text-zinc-200">
              {filterAndSort.volunteers.length} / {totalVolunteers}
            </span>
          </div>
          <div className="overflow-y-auto p-2 sm:p-2.5 space-y-1.5 custom-scroll flex-grow pb-20">
            {filterAndSort.volunteers.length === 0 ? (
              <div className="py-12 text-center text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                No volunteers match the current filter.
              </div>
            ) : (
              filterAndSort.volunteers.map(renderMemberRow)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
