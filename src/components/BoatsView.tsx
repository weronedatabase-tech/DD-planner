import React, { useState } from 'react';
import { Boat, BoatSeat, Member, BalanceMode } from '../types';
import { calculateBoatWeight } from '../utils/balancer';
import { formatDisplayDate } from '../utils/date';

interface BoatsViewProps {
  boats: Boat[];
  roster: Member[];
  attendance: string[];
  currentSessionDate: string | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddBoat: (type: 'standard' | 'small') => void;
  onRemoveBoat: (boatId: string) => void;
  onRunAutoBalance: (mode: BalanceMode) => void;
  onShowAlgoInfo: () => void;
  onSaveBoatCanvas: (boatId: string) => void;
  onSeatClick: (boatId: string, seat: BoatSeat) => void;
  onReturnToPool: (boatId: string, seat: BoatSeat) => void;
  onDropMemberToSeat: (
    memberName: string,
    targetBoatId: string,
    targetRole?: 'drummer' | 'helm',
    targetRow?: number,
    targetSide?: 'Left' | 'Right'
  ) => void;
  onDropMemberToPool: (memberName: string, fromBoatId?: string) => void;
}

export const BoatsView: React.FC<BoatsViewProps> = ({
  boats,
  roster,
  attendance,
  currentSessionDate,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddBoat,
  onRemoveBoat,
  onRunAutoBalance,
  onShowAlgoInfo,
  onSaveBoatCanvas,
  onSeatClick,
  onReturnToPool,
  onDropMemberToSeat,
  onDropMemberToPool,
}) => {
  const [balanceMode, setBalanceMode] = useState<BalanceMode>('stability');
  const [draggedMemberName, setDraggedMemberName] = useState<string | null>(null);
  const [draggedFromBoatId, setDraggedFromBoatId] = useState<string | null>(null);

  const memberMap = new Map<string, Member>();
  roster.forEach((m) => memberMap.set(m.name, m));

  // Determine seated names across all boats
  const seatedNames = new Set<string>();
  boats.forEach((b) => {
    b.seats.forEach((s) => {
      if (s.occupant) seatedNames.add(s.occupant);
    });
  });

  const attendeeMembers = attendance
    .map((name) => memberMap.get(name))
    .filter((m): m is Member => !!m);

  const totalPaddlers = attendeeMembers.filter((m) => m.type === 'Paddler').length;
  const totalVolunteers = attendeeMembers.filter((m) => m.type === 'Volunteer').length;

  let seatedPaddlersCount = 0;
  let seatedVolunteersCount = 0;
  boats.forEach((b) => {
    b.seats.forEach((s) => {
      if (s.occupant) {
        const mem = memberMap.get(s.occupant);
        if (mem?.type === 'Paddler') seatedPaddlersCount++;
        else if (mem?.type === 'Volunteer') seatedVolunteersCount++;
      }
    });
  });

  const poolPaddlersCount = Math.max(0, totalPaddlers - seatedPaddlersCount);
  const poolVolunteersCount = Math.max(0, totalVolunteers - seatedVolunteersCount);

  // Grouping for Pool:
  // Each attendee paddler has their own pool-group with linked volunteers
  const attendeePaddlers = attendeeMembers
    .filter((m) => m.type === 'Paddler')
    .sort((a, b) => a.name.localeCompare(b.name));
  const attendeeVolunteers = attendeeMembers
    .filter((m) => m.type === 'Volunteer')
    .sort((a, b) => a.name.localeCompare(b.name));

  const volMap = new Map<string, Member>();
  attendeeVolunteers.forEach((v) => volMap.set(v.name, v));

  const displayedVolunteerNames = new Set<string>();

  const poolGroups = attendeePaddlers.map((paddler) => {
    const linkedNames = paddler.volunteers
      ? paddler.volunteers.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const matchedVols: Member[] = [];
    linkedNames.forEach((vName) => {
      const vMem = volMap.get(vName);
      if (vMem) {
        matchedVols.push(vMem);
        displayedVolunteerNames.add(vName);
      }
    });
    return {
      paddler,
      linkedVolunteers: matchedVols,
    };
  });

  const orphanVolunteers = attendeeVolunteers.filter((v) => !displayedVolunteerNames.has(v.name));

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, name: string, fromBoatId?: string) => {
    if (seatedNames.has(name) && !fromBoatId) {
      e.preventDefault();
      return;
    }
    setDraggedMemberName(name);
    setDraggedFromBoatId(fromBoatId || null);
    e.dataTransfer.setData('text/plain', name);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnSeat = (
    e: React.DragEvent,
    targetBoatId: string,
    role?: 'drummer' | 'helm',
    row?: number,
    side?: 'Left' | 'Right'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const name = draggedMemberName || e.dataTransfer.getData('text/plain');
    if (!name) return;
    onDropMemberToSeat(name, targetBoatId, role, row, side);
    setDraggedMemberName(null);
    setDraggedFromBoatId(null);
  };

  const handleDropOnPool = (e: React.DragEvent) => {
    e.preventDefault();
    const name = draggedMemberName || e.dataTransfer.getData('text/plain');
    if (!name) return;
    onDropMemberToPool(name, draggedFromBoatId || undefined);
    setDraggedMemberName(null);
    setDraggedFromBoatId(null);
  };

  const renderSeatNode = (
    member: Member,
    isSeatedInPool: boolean,
    fromBoatId?: string,
    seatRef?: BoatSeat
  ) => {
    const typeClass =
      member.type === 'Volunteer'
        ? 'volunteer'
        : member.type === 'Paddler'
        ? 'paddler'
        : 'drummer-helm';
    const sideDisplay = member.side && member.side.length > 0 ? member.side.substring(0, 1) : '?';
    const weightDisplay = member.weight || 0;

    return (
      <div
        key={`${member.name}-${fromBoatId || 'pool'}`}
        draggable={!isSeatedInPool}
        onDragStart={(e) => handleDragStart(e, member.name, fromBoatId)}
        onClick={(e) => {
          e.stopPropagation();
          if (fromBoatId && seatRef) {
            onSeatClick(fromBoatId, seatRef);
          }
        }}
        data-name={member.name}
        data-weight={weightDisplay}
        data-type={member.type}
        data-side={member.side || 'Any'}
        className={`seat ${typeClass} rounded shadow-sm z-10 w-full mb-1 flex-shrink-0 cursor-grab ${
          isSeatedInPool ? 'seated-in-pool' : ''
        }`}
      >
        <span>{member.name}</span>
        <span className="opacity-75 text-[10px] weight-text">
          {weightDisplay}kg {sideDisplay}
        </span>
        {fromBoatId && seatRef && (
          <div
            className="remove-x"
            onClick={(e) => {
              e.stopPropagation();
              onReturnToPool(fromBoatId, seatRef);
            }}
            title="Return to pool"
          >
            ×
          </div>
        )}
      </div>
    );
  };

  const displayDateStr = formatDisplayDate(currentSessionDate);

  const dlIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
      />
    </svg>
  );

  return (
    <div id="view-planning" className="h-full flex flex-col w-full">
      {/* Top Header & Actions */}
      <div className="flex-none z-20 shadow-sm bg-surface-light dark:bg-surface-dark bg-white dark:bg-gray-800 pb-2">
        <div className="bg-gray-100 dark:bg-gray-900 p-1 text-[10px] flex justify-between px-2 border-b dark:border-gray-700 font-mono">
          <div className="flex gap-3">
            <span className="text-gray-500 uppercase font-bold">Pool:</span>
            <span className="text-gray-600 dark:text-gray-300">
              P:<b id="pool-paddlers" className="text-blue-600 dark:text-blue-400">{poolPaddlersCount}</b>
            </span>
            <span className="text-gray-600 dark:text-gray-300">
              V:<b id="pool-vols" className="text-green-600 dark:text-green-400">{poolVolunteersCount}</b>
            </span>
          </div>
          <div className="flex gap-3">
            <span className="text-gray-500 uppercase font-bold">Total:</span>
            <span className="text-gray-600 dark:text-gray-300">
              P:<b id="total-paddlers" className="text-blue-600 dark:text-blue-400">{totalPaddlers}</b>
            </span>
            <span className="text-gray-600 dark:text-gray-300">
              V:<b id="total-vols" className="text-green-600 dark:text-green-400">{totalVolunteers}</b>
            </span>
          </div>
        </div>

        <div className="px-2 mt-2 flex flex-col gap-2">
          <div className="flex gap-2 w-full">
            <div className="w-1/3 flex gap-1">
              <button
                type="button"
                id="undo-btn"
                onClick={onUndo}
                disabled={!canUndo}
                className={`flex-1 bg-orange-500 text-white py-2 rounded-l text-xs font-bold shadow transition-opacity flex items-center justify-center cursor-pointer ${
                  canUndo ? 'hover:bg-orange-600 opacity-100' : 'opacity-50 pointer-events-none'
                }`}
                title="Undo"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
              </button>
              <button
                type="button"
                id="redo-btn"
                onClick={onRedo}
                disabled={!canRedo}
                className={`flex-1 bg-orange-500 text-white py-2 rounded-r text-xs font-bold shadow transition-opacity flex items-center justify-center cursor-pointer ${
                  canRedo ? 'hover:bg-orange-600 opacity-100' : 'opacity-50 pointer-events-none'
                }`}
                title="Redo"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              onClick={() => onAddBoat('standard')}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-xs font-bold shadow cursor-pointer"
            >
              + Standard (20)
            </button>
            <button
              type="button"
              onClick={() => onAddBoat('small')}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-xs font-bold shadow cursor-pointer"
            >
              + Small (10)
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 p-1 rounded border dark:border-gray-700">
            <div className="text-[10px] font-bold text-gray-500 uppercase px-1 mb-1 dark:text-gray-300">
              Auto-Balancing
            </div>
            <div className="flex items-center gap-2">
              <select
                id="balance-mode"
                value={balanceMode}
                onChange={(e) => setBalanceMode(e.target.value as BalanceMode)}
                className="flex-1 text-xs p-1 border rounded dark:bg-gray-900 dark:border-gray-600 font-medium dark:text-white"
              >
                <option value="stability">Stability (L/R)</option>
                <option value="rocket">Rocket (Engine)</option>
              </select>
              <button
                type="button"
                onClick={onShowAlgoInfo}
                className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs cursor-pointer hover:bg-blue-200"
              >
                i
              </button>
              <button
                type="button"
                onClick={() => onRunAutoBalance(balanceMode)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs font-bold cursor-pointer"
              >
                GO
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Area: Pool (left) and Boats Area (right) */}
      <div className="flex-grow flex overflow-hidden">
        {/* Pool Container */}
        <div
          id="pool-container"
          onDragOver={handleDragOver}
          onDrop={handleDropOnPool}
          className="w-[28%] min-w-[95px] max-w-[130px] sm:max-w-[180px] bg-gray-200 dark:bg-gray-900 border-r dark:border-gray-700 overflow-y-auto p-2 flex flex-col gap-1 droppable custom-scroll pb-24"
        >
          {poolGroups.map(({ paddler, linkedVolunteers }) => (
            <div key={paddler.name} className="pool-group">
              <div className="pool-group-label">Linked Group</div>
              {renderSeatNode(paddler, seatedNames.has(paddler.name))}
              {linkedVolunteers.map((vol) =>
                renderSeatNode(vol, seatedNames.has(vol.name))
              )}
            </div>
          ))}

          {orphanVolunteers.length > 0 && (
            <div className="mt-2 border-t border-gray-300 dark:border-gray-600 pt-2 space-y-1">
              {orphanVolunteers.map((vol) =>
                renderSeatNode(vol, seatedNames.has(vol.name))
              )}
            </div>
          )}

          {attendeeMembers.length === 0 && (
            <div className="text-[10px] text-gray-500 italic text-center py-4">
              No members in session
            </div>
          )}
        </div>

        {/* Boats Area */}
        <div
          id="boats-area"
          className="flex-1 bg-gray-50 dark:bg-gray-900 overflow-y-auto p-2 flex flex-col gap-6 pb-24 custom-scroll"
        >
          {boats.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-gray-400 text-center">
              <p className="text-sm font-semibold mb-2">No boats created yet.</p>
              <p className="text-xs">Click + Standard (20) or + Small (10) above to add a boat.</p>
            </div>
          ) : (
            boats.map((boat, boatIndex) => {
              const numRows = boat.type === 'standard' ? 10 : 5;
              const weights = calculateBoatWeight(boat, memberMap);
              const round = (num: number) => Math.round(num * 10) / 10;
              const roundedL = round(weights.left);
              const roundedR = round(weights.right);
              const diff = round(roundedL - roundedR);
              const balText = diff === 0 ? 'OK' : diff > 0 ? `L+${diff}` : `R+${Math.abs(diff)}`;
              const isUnbalanced = Math.abs(diff) > 10;

              const drummerSeat = boat.seats.find((s) => s.role === 'drummer') || {
                role: 'drummer',
                occupant: null,
              };
              const helmSeat = boat.seats.find((s) => s.role === 'helm') || {
                role: 'helm',
                occupant: null,
              };

              return (
                <div
                  key={boat.id}
                  id={boat.id}
                  data-type={boat.type}
                  className="boat-wrapper bg-blue-50 dark:bg-gray-800 border-2 border-blue-600 dark:border-blue-900 rounded-lg p-3 w-full flex-shrink-0"
                >
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold dark:text-white text-sm boat-title">
                      Boat {boatIndex + 1} ({boat.type})
                    </h4>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onSaveBoatCanvas(boat.id)}
                        className="text-blue-600 border border-blue-200 bg-white dark:bg-gray-700 dark:border-gray-600 p-1 rounded hover:bg-blue-50 dark:hover:bg-gray-600 cursor-pointer"
                        title="Save to Drive"
                      >
                        {dlIcon}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Are you sure you want to remove this boat?')) {
                            onRemoveBoat(boat.id);
                          }
                        }}
                        className="text-red-500 text-xs font-bold px-2 border border-red-200 rounded bg-white dark:bg-gray-700 dark:border-gray-600 hover:bg-red-50 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="text-center text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 boat-date">
                    {displayDateStr}
                  </div>

                  <div className="grid grid-cols-[45px_1fr_1fr] gap-1 mb-1">
                    {/* Coach / Drum */}
                    <div className="flex items-center justify-center text-[9px] font-bold text-gray-500 dark:text-gray-400 leading-tight text-center">
                      Coach/ Drum
                    </div>
                    <div
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnSeat(e, boat.id, 'drummer')}
                      onClick={() => onSeatClick(boat.id, drummerSeat)}
                      data-role="drummer"
                      className="col-span-2 seat drummer-helm droppable"
                    >
                      {drummerSeat.occupant && memberMap.get(drummerSeat.occupant)
                        ? renderSeatNode(
                            memberMap.get(drummerSeat.occupant)!,
                            false,
                            boat.id,
                            drummerSeat
                          )
                        : null}
                    </div>

                    {/* Rows */}
                    {Array.from({ length: numRows }, (_, idx) => {
                      const rowNum = idx + 1;
                      const leftSeat = boat.seats.find((s) => s.row === rowNum && s.side === 'Left') || {
                        row: rowNum,
                        side: 'Left' as const,
                        occupant: null,
                      };
                      const rightSeat = boat.seats.find((s) => s.row === rowNum && s.side === 'Right') || {
                        row: rowNum,
                        side: 'Right' as const,
                        occupant: null,
                      };

                      return (
                        <React.Fragment key={rowNum}>
                          <div className="flex items-center justify-center font-bold text-gray-500 dark:text-gray-400 text-xs">
                            {rowNum}
                          </div>
                          <div
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDropOnSeat(e, boat.id, undefined, rowNum, 'Left')}
                            onClick={() => onSeatClick(boat.id, leftSeat)}
                            data-row={rowNum}
                            data-side="Left"
                            className="seat droppable"
                          >
                            {leftSeat.occupant && memberMap.get(leftSeat.occupant)
                              ? renderSeatNode(
                                  memberMap.get(leftSeat.occupant)!,
                                  false,
                                  boat.id,
                                  leftSeat
                                )
                              : null}
                          </div>
                          <div
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDropOnSeat(e, boat.id, undefined, rowNum, 'Right')}
                            onClick={() => onSeatClick(boat.id, rightSeat)}
                            data-row={rowNum}
                            data-side="Right"
                            className="seat droppable"
                          >
                            {rightSeat.occupant && memberMap.get(rightSeat.occupant)
                              ? renderSeatNode(
                                  memberMap.get(rightSeat.occupant)!,
                                  false,
                                  boat.id,
                                  rightSeat
                                )
                              : null}
                          </div>
                        </React.Fragment>
                      );
                    })}

                    {/* Steer */}
                    <div className="flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-gray-400">
                      Steer
                    </div>
                    <div
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnSeat(e, boat.id, 'helm')}
                      onClick={() => onSeatClick(boat.id, helmSeat)}
                      data-role="helm"
                      className="col-span-2 seat drummer-helm droppable"
                    >
                      {helmSeat.occupant && memberMap.get(helmSeat.occupant)
                        ? renderSeatNode(
                            memberMap.get(helmSeat.occupant)!,
                            false,
                            boat.id,
                            helmSeat
                          )
                        : null}
                    </div>

                    {/* Stats Bar */}
                    <div className="col-start-2 col-span-2 mt-1 text-[10px] flex justify-between font-mono p-1.5 bg-white dark:bg-gray-900 rounded border dark:border-gray-700 dark:text-gray-300 shadow-sm boat-stats-bar">
                      <span className="font-bold">L: {roundedL}</span>
                      <span
                        className={`font-bold ${
                          isUnbalanced ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        Bal: {balText}
                      </span>
                      <span className="font-bold">R: {roundedR}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
