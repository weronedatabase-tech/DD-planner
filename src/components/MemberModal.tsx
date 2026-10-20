import React, { useState, useEffect } from 'react';
import { Member } from '../types';

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

  useEffect(() => {
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
    .filter((m) => m.type === targetRole && m.name !== name)
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
      alert('Please enter member name');
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-light dark:bg-surface-dark bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-sm shadow-2xl">
        <h3 className="font-bold mb-4 text-base dark:text-white">
          {member ? 'Edit Member' : 'Manage Member'}
        </h3>
        <form onSubmit={handleSave}>
          <label className="block text-xs font-bold text-gray-500 uppercase mt-2 dark:text-gray-300">
            Full Name
          </label>
          <input
            id="m-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border p-2 rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white text-sm"
            placeholder="e.g. John Doe"
            required
          />

          <div className="flex gap-2 mt-2">
            <div className="w-1/2">
              <label className="block text-xs font-bold text-gray-500 uppercase dark:text-gray-300">
                Role
              </label>
              <select
                id="m-type"
                value={type}
                onChange={(e) => setType(e.target.value as 'Paddler' | 'Volunteer')}
                className="w-full border p-2 rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white text-sm"
              >
                <option value="Paddler">Paddler</option>
                <option value="Volunteer">Volunteer</option>
              </select>
            </div>
            <div className="w-1/2">
              <label className="block text-xs font-bold text-gray-500 uppercase dark:text-gray-300">
                Side Pref
              </label>
              <select
                id="m-side"
                value={side}
                onChange={(e) => setSide(e.target.value as 'Any' | 'Left' | 'Right')}
                className="w-full border p-2 rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white text-sm"
              >
                <option value="Any">Any</option>
                <option value="Left">Left</option>
                <option value="Right">Right</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 mt-2 mb-4">
            <div className="w-1/2">
              <label className="block text-xs font-bold text-gray-500 uppercase dark:text-gray-300">
                Gender
              </label>
              <select
                id="m-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as 'M' | 'F')}
                className="w-full border p-2 rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white text-sm"
              >
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>
            <div className="w-1/2">
              <label className="block text-xs font-bold text-gray-500 uppercase dark:text-gray-300">
                Weight (kg)
              </label>
              <input
                type="number"
                id="m-weight"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full border p-2 rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white text-sm"
                placeholder="e.g. 75"
              />
            </div>
          </div>

          <div id="m-link-section" className="mb-4 border-t pt-2 dark:border-gray-700">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 dark:text-gray-300">
              {type === 'Paddler' ? 'Linked Volunteers' : 'Linked Paddlers'}
            </label>
            <div className="max-h-32 overflow-y-auto border rounded p-2 bg-gray-50 dark:bg-gray-900 dark:border-gray-700 space-y-1 custom-scroll">
              {availableLinkedCandidates.length === 0 ? (
                <span className="text-xs italic text-gray-400">
                  No {targetRole}s found in roster.
                </span>
              ) : (
                availableLinkedCandidates.map((candidate) => (
                  <label
                    key={candidate.name}
                    className="flex items-center space-x-2 text-xs cursor-pointer select-none py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLinks.includes(candidate.name)}
                      onChange={() => handleLinkToggle(candidate.name)}
                      className="rounded"
                    />
                    <span className="dark:text-white">{candidate.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold shadow hover:bg-blue-700 cursor-pointer"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
