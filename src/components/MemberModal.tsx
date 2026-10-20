import React, { useState, useEffect } from 'react';
import { Member } from '../types';
import { X, Search } from 'lucide-react';

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (member: Member) => void;
  member: Member | null;
  allMembers: Member[];
}

export const MemberModal: React.FC<MemberModalProps> = ({
  isOpen,
  onClose,
  onSave,
  member,
  allMembers,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'Paddler' | 'Volunteer'>('Paddler');
  const [side, setSide] = useState<'Any' | 'Left' | 'Right'>('Any');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [weight, setWeight] = useState<string>('');
  const [selectedLinks, setSelectedLinks] = useState<string[]>([]);
  const [linkSearch, setLinkSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setErrorMsg(null);
    setLinkSearch('');
    if (member) {
      setName(member.name || '');
      setType(member.type || 'Paddler');
      setSide(member.side || 'Any');
      setGender(member.gender || 'M');
      setWeight(member.weight !== undefined ? String(member.weight) : '');
      const links = member.volunteers
        ? member.volunteers.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      setSelectedLinks(links);
    } else {
      setName('');
      setType('Paddler');
      setSide('Any');
      setGender('M');
      setWeight('');
      setSelectedLinks([]);
    }
  }, [member, isOpen]);

  if (!isOpen) return null;

  const targetRole = type === 'Paddler' ? 'Volunteer' : 'Paddler';
  const availableLinkedCandidates = allMembers
    .filter(
      (m) =>
        m.type === targetRole &&
        m.name !== name &&
        (!linkSearch.trim() || m.name.toLowerCase().includes(linkSearch.toLowerCase()))
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleLinkToggle = (candidateName: string) => {
    setSelectedLinks((prev) =>
      prev.includes(candidateName)
        ? prev.filter((n) => n !== candidateName)
        : [...prev, candidateName]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter the member full name.');
      return;
    }
    const updatedMember: Member = {
      rowIndex: member ? member.rowIndex : null,
      name: name.trim(),
      type,
      side,
      gender,
      weight: Number(weight) || 0,
      active: true,
      volunteers: selectedLinks.join(','),
    };
    onSave(updatedMember);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[80] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 rounded-xl w-full max-w-md max-h-[90dvh] overflow-y-auto custom-scroll shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-display font-extrabold text-base sm:text-lg text-zinc-950 dark:text-white">
              {member ? 'Edit Roster Member' : 'Add Roster Member'}
            </h3>
            <p className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-200 mt-0.5">
              Synced directly with the Roster tab in Google Sheets
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-700 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-xs sm:text-sm font-bold text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          <div>
            <label
              htmlFor="m-name"
              className="block text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-1.5"
            >
              Full Name
            </label>
            <input
              id="m-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              className="w-full border border-zinc-300 dark:border-zinc-700 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#14141b] text-zinc-950 dark:text-white font-semibold text-sm placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:border-sky-500 transition-colors"
              placeholder="e.g. Alex Wong"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="m-type"
                className="block text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-1.5"
              >
                Role
              </label>
              <select
                id="m-type"
                value={type}
                onChange={(e) => setType(e.target.value as 'Paddler' | 'Volunteer')}
                className="w-full border border-zinc-300 dark:border-zinc-700 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#14141b] text-zinc-950 dark:text-white font-semibold text-sm focus:outline-none focus:border-sky-500"
              >
                <option value="Paddler">Paddler</option>
                <option value="Volunteer">Volunteer</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="m-side"
                className="block text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-1.5"
              >
                Side Preference
              </label>
              <select
                id="m-side"
                value={side}
                onChange={(e) => setSide(e.target.value as 'Any' | 'Left' | 'Right')}
                className="w-full border border-zinc-300 dark:border-zinc-700 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#14141b] text-zinc-950 dark:text-white font-semibold text-sm focus:outline-none focus:border-sky-500"
              >
                <option value="Any">Any Side</option>
                <option value="Left">Left (Port)</option>
                <option value="Right">Right (Starboard)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="m-gender"
                className="block text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-1.5"
              >
                Gender
              </label>
              <select
                id="m-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as 'M' | 'F')}
                className="w-full border border-zinc-300 dark:border-zinc-700 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#14141b] text-zinc-950 dark:text-white font-semibold text-sm focus:outline-none focus:border-sky-500"
              >
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="m-weight"
                className="block text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-1.5"
              >
                Weight (kg)
              </label>
              <input
                type="number"
                id="m-weight"
                step="0.5"
                min="0"
                max="250"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full border border-zinc-300 dark:border-zinc-700 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#14141b] text-zinc-950 dark:text-white text-sm font-mono font-bold tabular-nums placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:border-sky-500"
                placeholder="e.g. 75"
              />
            </div>
          </div>

          <div
            id="m-link-section"
            className="pt-3 border-t border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100">
                {type === 'Paddler' ? 'Linked Volunteers' : 'Linked Paddlers'}
                {selectedLinks.length > 0 && (
                  <span className="ml-1.5 font-mono text-sky-700 dark:text-sky-300">
                    ({selectedLinks.length} selected)
                  </span>
                )}
              </label>
              {selectedLinks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedLinks([])}
                  className="text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="relative mb-2">
              <Search className="w-4 h-4 text-zinc-500 dark:text-zinc-300 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                placeholder={`Filter ${targetRole.toLowerCase()}s...`}
                className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-[#14141b] text-zinc-950 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="max-h-36 overflow-y-auto border border-zinc-300 dark:border-zinc-700 rounded-lg p-1.5 bg-zinc-50 dark:bg-[#0e0e13] space-y-1 custom-scroll">
              {availableLinkedCandidates.length === 0 ? (
                <div className="py-4 text-center text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                  No matching {targetRole.toLowerCase()}s in roster.
                </div>
              ) : (
                availableLinkedCandidates.map((candidate) => {
                  const checked = selectedLinks.includes(candidate.name);
                  return (
                    <label
                      key={candidate.name}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-md text-xs sm:text-sm cursor-pointer select-none transition-colors ${
                        checked
                          ? 'bg-sky-500/20 text-sky-950 dark:text-sky-100 font-bold'
                          : 'hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleLinkToggle(candidate.name)}
                          className="w-4 h-4 rounded border-zinc-400 dark:border-zinc-600 accent-sky-500"
                        />
                        <span className="truncate">{candidate.name}</span>
                      </div>
                      <span className="text-xs font-mono font-bold tabular-nums text-zinc-700 dark:text-zinc-200 shrink-0 ml-2">
                        {candidate.weight}kg · {candidate.side}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              {member ? 'Save Changes' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
