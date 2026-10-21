import React, { useState, useRef, useEffect } from 'react';
import { Boat, BoatSeat, Member, BalanceMode, CollaboratorPresence } from '../types';
import { calculateBoatWeight } from '../utils/balancer';
import { formatDisplayDate } from '../utils/date';
import {
  Undo2,
  Redo2,
  Plus,
  Sparkles,
  Info,
  Share2,
  Trash2,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';

interface BoatsViewProps {
  boats: Boat[];
  roster: Member[];
  attendance: string[];
  currentSessionDate: string | null;
  canUndo: boolean;
  canRedo: boolean;
  activeUsers?: CollaboratorPresence[];
  currentClientId?: string;
  onUndo: () => void;
  onRedo: () => void;
  onAddBoat: (type: 'standard' | 'small') => void;
  onRemoveBoat: (boatId: string) => void;
  onClearBoatSeats?: (boatId: string) => void;
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
    targetSide?: 'Left' | 'Right',
    fromBoatId?: string | null
  ) => void;
  onDropMemberToPool: (memberName: string, fromBoatId?: string) => void;
  onDragStateChange?: (isDragging: boolean) => void;
}

export const BoatsView: React.FC<BoatsViewProps> = ({
  boats,
  roster,
  attendance,
  currentSessionDate,
  canUndo,
  canRedo,
  activeUsers = [],
  currentClientId,
  onUndo,
  onRedo,
  onAddBoat,
  onRemoveBoat,
  onClearBoatSeats,
  onRunAutoBalance,
  onShowAlgoInfo,
  onSaveBoatCanvas,
  onSeatClick,
  onReturnToPool,
  onDropMemberToSeat,
  onDropMemberToPool,
  onDragStateChange,
}) => {
  const [balanceMode, setBalanceMode] = useState<BalanceMode>('stability');
  const [draggedMemberName, setDraggedMemberName] = useState<string | null>(null);
  const [draggedFromBoatId, setDraggedFromBoatId] = useState<string | null>(null);
  const [selectedPoolMember, setSelectedPoolMember] = useState<string | null>(null);
  const [poolSearch, setPoolSearch] = useState('');
  const [hideSeatedInPool, setHideSeatedInPool] = useState(false);

  // Mobile Touch Drag state
  const [touchGhost, setTouchGhost] = useState<{
    name: string;
    x: number;
    y: number;
  } | null>(null);
  const touchDragStateRef = useRef<{
    name: string;
    fromBoatId?: string;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    active: boolean;
    scrolling: boolean;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const hoveredSeatElRef = useRef<HTMLElement | null>(null);
  const justDraggedRef = useRef(false);
  const callbacksRef = useRef({
    onDropMemberToSeat,
    onDropMemberToPool,
    onDragStateChange,
  });
  callbacksRef.current = {
    onDropMemberToSeat,
    onDropMemberToPool,
    onDragStateChange,
  };

  const clearHoveredSeatHighlight = () => {
    if (hoveredSeatElRef.current) {
      hoveredSeatElRef.current.classList.remove('ring-2', 'ring-sky-500', 'scale-[1.02]');
      hoveredSeatElRef.current = null;
    }
  };

  // Native non-passive touch listeners so active drags never trigger vertical page scroll
  useEffect(() => {
    const onWindowTouchMove = (e: TouchEvent) => {
      const state = touchDragStateRef.current;
      if (!state || state.scrolling) return;
      const touch = e.touches[0];
      if (!touch) return;

      const x = touch.clientX;
      const y = touch.clientY;
      state.lastX = x;
      state.lastY = y;
      const dx = Math.abs(x - state.startX);
      const dy = Math.abs(y - state.startY);

      if (!state.active) {
        // If user swipes predominantly vertically, let native vertical scroll handle it seamlessly
        if (dy > 8 && dy > dx * 1.35) {
          if (state.timer) clearTimeout(state.timer);
          state.scrolling = true;
          touchDragStateRef.current = null;
          return;
        }
        // Activate drag immediately on any horizontal/diagonal movement (no long press needed)
        if (dx >= 5 && dx >= dy * 0.65) {
          if (state.timer) clearTimeout(state.timer);
          state.active = true;
          callbacksRef.current.onDragStateChange?.(true);
        } else {
          return;
        }
      }

      // Prevent vertical scroll once drag is active
      if (e.cancelable) {
        e.preventDefault();
      }

      setTouchGhost({ name: state.name, x, y });

      // Highlight seat under finger
      const el = document.elementFromPoint(x, y);
      const seatEl = (el?.closest('[data-boat-id]') as HTMLElement | null) || null;
      if (hoveredSeatElRef.current !== seatEl) {
        clearHoveredSeatHighlight();
        if (seatEl) {
          seatEl.classList.add('ring-2', 'ring-sky-500', 'scale-[1.02]');
          hoveredSeatElRef.current = seatEl;
        }
      }

      // Smoothly auto-scroll #boats-area when dragging near top or bottom edges
      const boatsArea = document.getElementById('boats-area');
      if (boatsArea) {
        const rect = boatsArea.getBoundingClientRect();
        const edgeThreshold = 56;
        if (x >= rect.left && x <= rect.right) {
          if (y < rect.top + edgeThreshold && y > rect.top - 20) {
            boatsArea.scrollTop -= 10;
          } else if (y > rect.bottom - edgeThreshold && y < rect.bottom + 20) {
            boatsArea.scrollTop += 10;
          }
        }
      }
    };

    const finishTouchDrag = (e: TouchEvent) => {
      const state = touchDragStateRef.current;
      if (!state) return;
      if (state.timer) clearTimeout(state.timer);
      touchDragStateRef.current = null;
      clearHoveredSeatHighlight();

      if (!state.active) return;

      justDraggedRef.current = true;
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 120);

      setTouchGhost(null);
      callbacksRef.current.onDragStateChange?.(false);

      const touch = e.changedTouches[0];
      const dropX = touch ? touch.clientX : state.lastX;
      const dropY = touch ? touch.clientY : state.lastY;

      const el = document.elementFromPoint(dropX, dropY);
      if (!el) return;

      const seatEl = el.closest('[data-boat-id]') as HTMLElement | null;
      if (seatEl) {
        const targetBoatId = seatEl.getAttribute('data-boat-id')!;
        const roleAttr = seatEl.getAttribute('data-role') as 'drummer' | 'helm' | null;
        const rowAttr = seatEl.getAttribute('data-row');
        const sideAttr = seatEl.getAttribute('data-side') as 'Left' | 'Right' | null;

        callbacksRef.current.onDropMemberToSeat(
          state.name,
          targetBoatId,
          roleAttr || undefined,
          rowAttr ? Number(rowAttr) : undefined,
          sideAttr || undefined,
          state.fromBoatId || null
        );
        setSelectedPoolMember(null);
        return;
      }

      const poolEl = el.closest('#pool-container');
      if (poolEl && state.fromBoatId) {
        callbacksRef.current.onDropMemberToPool(state.name, state.fromBoatId);
      }
    };

    window.addEventListener('touchmove', onWindowTouchMove, { passive: false });
    window.addEventListener('touchend', finishTouchDrag, { passive: true });
    window.addEventListener('touchcancel', finishTouchDrag, { passive: true });
    return () => {
      window.removeEventListener('touchmove', onWindowTouchMove);
      window.removeEventListener('touchend', finishTouchDrag);
      window.removeEventListener('touchcancel', finishTouchDrag);
    };
  }, []);

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
  const attendeePaddlers = attendeeMembers
    .filter((m) => m.type === 'Paddler')
    .sort((a, b) => a.name.localeCompare(b.name));
  const attendeeVolunteers = attendeeMembers
    .filter((m) => m.type === 'Volunteer')
    .sort((a, b) => a.name.localeCompare(b.name));

  const volMap = new Map<string, Member>();
  attendeeVolunteers.forEach((v) => volMap.set(v.name, v));

  const displayedVolunteerNames = new Set<string>();

  const poolGroups = attendeePaddlers
    .map((paddler) => {
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
    })
    .filter(({ paddler, linkedVolunteers }) => {
      if (hideSeatedInPool) {
        const anyUnseated =
          !seatedNames.has(paddler.name) ||
          linkedVolunteers.some((v) => !seatedNames.has(v.name));
        if (!anyUnseated) return false;
      }
      if (!poolSearch.trim()) return true;
      const q = poolSearch.toLowerCase();
      return (
        paddler.name.toLowerCase().includes(q) ||
        linkedVolunteers.some((v) => v.name.toLowerCase().includes(q))
      );
    });

  const orphanVolunteers = attendeeVolunteers.filter((v) => {
    if (displayedVolunteerNames.has(v.name)) return false;
    if (hideSeatedInPool && seatedNames.has(v.name)) return false;
    if (poolSearch.trim() && !v.name.toLowerCase().includes(poolSearch.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Desktop HTML5 Drag handlers
  const handleDragStart = (e: React.DragEvent, name: string, fromBoatId?: string) => {
    if (seatedNames.has(name) && !fromBoatId) {
      e.preventDefault();
      return;
    }
    setDraggedMemberName(name);
    setDraggedFromBoatId(fromBoatId || null);
    onDragStateChange?.(true);
    e.dataTransfer.setData('text/plain', name);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedMemberName(null);
    setDraggedFromBoatId(null);
    onDragStateChange?.(false);
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
    onDropMemberToSeat(name, targetBoatId, role, row, side, draggedFromBoatId);
    setDraggedMemberName(null);
    setDraggedFromBoatId(null);
    setSelectedPoolMember(null);
    onDragStateChange?.(false);
  };

  const handleDropOnPool = (e: React.DragEvent) => {
    e.preventDefault();
    const name = draggedMemberName || e.dataTransfer.getData('text/plain');
    if (!name) return;
    onDropMemberToPool(name, draggedFromBoatId || undefined);
    setDraggedMemberName(null);
    setDraggedFromBoatId(null);
    onDragStateChange?.(false);
  };

  // Mobile Touch Drag start (activates immediately on horizontal/diagonal movement without long-press, or after 110ms for vertical seat moves)
  const handleTouchStart = (e: React.TouchEvent, name: string, fromBoatId?: string) => {
    if (seatedNames.has(name) && !fromBoatId) return;
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;

    if (touchDragStateRef.current?.timer) {
      clearTimeout(touchDragStateRef.current.timer);
    }

    const timer = fromBoatId
      ? setTimeout(() => {
          if (touchDragStateRef.current && !touchDragStateRef.current.scrolling) {
            touchDragStateRef.current.active = true;
            onDragStateChange?.(true);
            setTouchGhost({
              name,
              x: touchDragStateRef.current.lastX,
              y: touchDragStateRef.current.lastY,
            });
          }
        }, 110)
      : null;

    touchDragStateRef.current = {
      name,
      fromBoatId,
      startX,
      startY,
      lastX: startX,
      lastY: startY,
      active: false,
      scrolling: false,
      timer,
    };
  };

  // Handle Seat Tap (places selected pool member immediately, or opens AssignModal)
  const handleBenchSeatInteraction = (boatId: string, seat: BoatSeat) => {
    if (justDraggedRef.current) return;
    if (selectedPoolMember) {
      onDropMemberToSeat(
        selectedPoolMember,
        boatId,
        seat.role,
        seat.row,
        seat.side,
        null
      );
      setSelectedPoolMember(null);
      return;
    }
    onSeatClick(boatId, seat);
  };

  const getSeatCollaborator = (
    boatId: string,
    role?: string,
    row?: number,
    side?: string
  ): CollaboratorPresence | undefined => {
    return activeUsers.find((u) => {
      if (u.clientId === currentClientId || !u.selectedSeat) return false;
      if (u.selectedSeat.boatId !== boatId) return false;
      if (role) return u.selectedSeat.role === role;
      return u.selectedSeat.row === row && u.selectedSeat.side === side;
    });
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
    const rawSide = member.side || 'Any';
    const sideDisplay = !fromBoatId
      ? rawSide === 'Left'
        ? 'L'
        : rawSide === 'Right'
        ? 'R'
        : 'A'
      : rawSide;
    const weightDisplay = member.weight || 0;
    const isPoolSelected = !fromBoatId && !isSeatedInPool && selectedPoolMember === member.name;

    return (
      <div
        key={`${member.name}-${fromBoatId || 'pool'}`}
        draggable={!isSeatedInPool}
        onDragStart={(e) => handleDragStart(e, member.name, fromBoatId)}
        onDragEnd={handleDragEnd}
        onTouchStart={(e) => handleTouchStart(e, member.name, fromBoatId)}
        onClick={(e) => {
          e.stopPropagation();
          if (justDraggedRef.current) return;
          if (fromBoatId && seatRef) {
            handleBenchSeatInteraction(fromBoatId, seatRef);
          } else if (!fromBoatId && !isSeatedInPool) {
            setSelectedPoolMember((prev) => (prev === member.name ? null : member.name));
          }
        }}
        data-name={member.name}
        data-weight={weightDisplay}
        data-type={member.type}
        data-side={member.side || 'Any'}
        className={`seat ${typeClass} z-10 w-full ${fromBoatId ? 'mb-0' : 'mb-1'} flex-shrink-0 ${
          isSeatedInPool ? 'seated-in-pool' : ''
        } ${isPoolSelected ? 'ring-2 ring-sky-500 dark:ring-white scale-[1.02]' : ''}`}
      >
        <span className="font-bold text-xs sm:text-[13px] leading-tight break-words text-center px-1">
          {member.name}
        </span>
        <span className="opacity-95 text-[10px] sm:text-[11px] font-semibold font-mono tabular-nums weight-text break-words text-center mt-0.5 leading-tight">
          {weightDisplay}kg · {sideDisplay}
        </span>
        {fromBoatId && seatRef && (
          <button
            type="button"
            className="remove-x"
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onReturnToPool(fromBoatId, seatRef);
            }}
            title="Return to pool"
            aria-label={`Remove ${member.name}`}
          >
            <X className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        )}
      </div>
    );
  };

  const displayDateStr = formatDisplayDate(currentSessionDate);

  return (
    <div
      id="view-planning"
      className="h-full flex flex-col w-full max-w-[1440px] mx-auto overflow-x-hidden"
    >
      {/* Top Action & Telemetry Bar — maximized horizontal space across 2 tight rows, strictly bounded within screen edges */}
      <div className="flex-none z-20 bg-white dark:bg-[#09090b] border-b border-zinc-200 dark:border-zinc-800 px-1.5 sm:px-3 py-1 flex flex-col gap-1 w-full max-w-full overflow-hidden">
        {/* Row 1: Pool & Total Metrics (stretches to fill row) + Compact Distinct Add Boat Controls */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 w-full min-w-0">
          <div className="flex-1 min-w-0 flex items-center justify-around sm:justify-evenly gap-1 sm:gap-3 px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-md bg-zinc-100 dark:bg-[#14141b] border border-zinc-300 dark:border-zinc-700 text-[11px] sm:text-xs font-mono font-bold tabular-nums text-zinc-900 dark:text-zinc-100 overflow-hidden">
            <div className="flex items-center gap-0.5 sm:gap-1.5 min-w-0 truncate">
              <span className="text-zinc-700 dark:text-zinc-200">Pool:</span>
              <span>
                P:<b id="pool-paddlers" className="text-sky-700 dark:text-sky-300 ml-0.5">{poolPaddlersCount}</b>
              </span>
              <span>
                V:<b id="pool-vols" className="text-emerald-700 dark:text-emerald-300 ml-0.5">{poolVolunteersCount}</b>
              </span>
            </div>
            <span className="text-zinc-400 dark:text-zinc-600 shrink-0">|</span>
            <div className="flex items-center gap-0.5 sm:gap-1.5 min-w-0 truncate">
              <span className="text-zinc-700 dark:text-zinc-200">Total:</span>
              <span>
                P:<b id="total-paddlers" className="text-sky-700 dark:text-sky-300 ml-0.5">{totalPaddlers}</b>
              </span>
              <span>
                V:<b id="total-vols" className="text-emerald-700 dark:text-emerald-300 ml-0.5">{totalVolunteers}</b>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onAddBoat('standard')}
              className="justify-center bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white border border-violet-400/60 shadow-2xs px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[11px] sm:text-xs font-extrabold transition-colors cursor-pointer flex items-center gap-0.5 whitespace-nowrap shrink-0"
              title="Add Standard 20-Paddler Boat"
            >
              <Plus className="w-3 h-3 stroke-[2.5] shrink-0" />
              <span>Std (20)</span>
            </button>
            <button
              type="button"
              onClick={() => onAddBoat('small')}
              className="justify-center bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white border border-orange-400/60 shadow-2xs px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[11px] sm:text-xs font-extrabold transition-colors cursor-pointer flex items-center gap-0.5 whitespace-nowrap shrink-0"
              title="Add Small 10-Paddler Boat"
            >
              <Plus className="w-3 h-3 stroke-[2.5] shrink-0" />
              <span>Small (10)</span>
            </button>
          </div>
        </div>

        {/* Row 2: High-Visibility Undo/Redo + Auto-Balancing Controls */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 w-full min-w-0">
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              id="undo-btn"
              onClick={onUndo}
              disabled={!canUndo}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md border text-[11px] sm:text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                canUndo
                  ? 'bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-zinc-950 border-amber-500 shadow-xs ring-1 ring-amber-400/50'
                  : 'bg-zinc-200/90 dark:bg-zinc-800/90 text-zinc-500 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 opacity-70 pointer-events-none'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] shrink-0" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              id="redo-btn"
              onClick={onRedo}
              disabled={!canRedo}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md border text-[11px] sm:text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                canRedo
                  ? 'bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-zinc-950 border-amber-500 shadow-xs ring-1 ring-amber-400/50'
                  : 'bg-zinc-200/90 dark:bg-zinc-800/90 text-zinc-500 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 opacity-70 pointer-events-none'
              }`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] shrink-0" />
              <span>Redo</span>
            </button>
          </div>

          <div className="flex items-center gap-1 flex-1 bg-zinc-100 dark:bg-[#14141b] px-1.5 sm:px-2 py-0.5 rounded-md border border-zinc-300 dark:border-zinc-700 min-w-0">
            <span className="hidden sm:inline text-xs font-bold text-zinc-800 dark:text-zinc-100 whitespace-nowrap shrink-0">
              Auto-Balance:
            </span>
            <select
              id="balance-mode"
              value={balanceMode}
              onChange={(e) => setBalanceMode(e.target.value as BalanceMode)}
              className="flex-1 min-w-0 text-[11px] sm:text-xs px-1 sm:px-1.5 py-0.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-[#09090b] font-bold text-zinc-950 dark:text-white focus:outline-none focus:border-sky-500"
            >
              <option value="stability">Stability (L/R)</option>
              <option value="rocket">Rocket (Engine)</option>
            </select>
            <button
              type="button"
              onClick={onShowAlgoInfo}
              className="p-0.5 sm:p-1 rounded text-zinc-700 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
              title="Balancing Algorithm Info"
            >
              <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={() => onRunAutoBalance(balanceMode)}
              disabled={boats.length === 0}
              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white px-2 sm:px-2.5 py-0.5 sm:py-1 rounded text-[11px] sm:text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>Balance</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Tap-to-Place Banner when a pool member is tapped on mobile/desktop */}
      {selectedPoolMember && (
        <div className="flex-none bg-sky-600 text-white px-2.5 py-1 text-xs font-bold flex items-center justify-between gap-2 z-20">
          <span className="break-words">
            Placing <b>{selectedPoolMember}</b> — tap any boat seat to assign
          </span>
          <button
            type="button"
            onClick={() => setSelectedPoolMember(null)}
            className="p-0.5 rounded hover:bg-white/20 cursor-pointer flex items-center gap-1 shrink-0"
          >
            <span>Cancel</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Split Workspace: Pool (Left) + Boats Grid (Right) */}
      <div className="flex-grow flex overflow-hidden min-h-0">
        {/* Attendee Pool Sidebar — compact width to maximize space for Boat column */}
        <div
          id="pool-container"
          onDragOver={handleDragOver}
          onDrop={handleDropOnPool}
          className="w-[26%] min-w-[92px] max-w-[126px] sm:w-[168px] sm:max-w-none lg:w-[192px] flex-none bg-zinc-100 dark:bg-[#07070a] border-r border-zinc-200 dark:border-zinc-800 flex flex-col min-h-0"
        >
          {/* Pool Filter Header */}
          <div className="p-1 sm:p-1.5 border-b border-zinc-200 dark:border-zinc-800 space-y-1 bg-white dark:bg-[#0c0c10]">
            <div className="relative">
              <Search className="w-3 h-3 text-zinc-500 dark:text-zinc-300 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={poolSearch}
                onChange={(e) => setPoolSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-6 pr-1.5 py-1 text-[11px] sm:text-xs font-medium rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-[#14141b] text-zinc-950 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:border-sky-500"
              />
            </div>
            <label className="flex items-center justify-between gap-1 text-[10px] sm:text-xs font-semibold text-zinc-700 dark:text-zinc-200 px-0.5 cursor-pointer select-none">
              <span className="break-words">Hide seated</span>
              <input
                type="checkbox"
                checked={hideSeatedInPool}
                onChange={(e) => setHideSeatedInPool(e.target.checked)}
                className="rounded accent-sky-500 w-3.5 h-3.5 shrink-0"
              />
            </label>
          </div>

          <div className="overflow-y-auto p-1 sm:p-1.5 flex-1 flex flex-col gap-0.5 droppable custom-scroll pb-24">
            {poolGroups.map(({ paddler, linkedVolunteers }) =>
              linkedVolunteers.length > 0 ? (
                <div key={paddler.name} className="pool-group">
                  <div className="pool-group-label">
                    <span>Linked</span>
                  </div>
                  {renderSeatNode(paddler, seatedNames.has(paddler.name))}
                  {linkedVolunteers.map((vol) =>
                    renderSeatNode(vol, seatedNames.has(vol.name))
                  )}
                </div>
              ) : (
                <React.Fragment key={paddler.name}>
                  {renderSeatNode(paddler, seatedNames.has(paddler.name))}
                </React.Fragment>
              )
            )}

            {orphanVolunteers.length > 0 && (
              <div className="mt-0.5 pt-1 border-t border-zinc-300 dark:border-zinc-700 flex flex-col gap-0.5">
                {orphanVolunteers.map((vol) =>
                  renderSeatNode(vol, seatedNames.has(vol.name))
                )}
              </div>
            )}

            {attendeeMembers.length === 0 && (
              <div className="text-[11px] sm:text-xs font-medium text-zinc-600 dark:text-zinc-300 text-center py-6 px-1">
                No attendees marked yet. Use Session tab to check in members.
              </div>
            )}
          </div>
        </div>

        {/* Boats Canvas Area */}
        <div
          id="boats-area"
          className="flex-1 bg-zinc-50 dark:bg-black overflow-y-auto p-1 sm:p-2 custom-scroll pb-24"
        >
          {boats.length === 0 ? (
            <div className="h-full min-h-[280px] flex flex-col items-center justify-center p-4 sm:p-8 text-center border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-[#09090b]">
              <p className="font-display text-sm sm:text-lg font-bold text-zinc-950 dark:text-white mb-1">
                No Boats in This Session Yet
              </p>
              <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 max-w-sm mb-4">
                Add a Standard 20-paddler boat or a Small 10-paddler boat, then tap or drag members
                to assign seats or click Auto-Balance.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => onAddBoat('standard')}
                  className="bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white border border-violet-400/60 shadow-xs px-3 py-1.5 rounded-lg text-xs sm:text-sm font-extrabold transition-colors cursor-pointer"
                >
                  + Std (20)
                </button>
                <button
                  type="button"
                  onClick={() => onAddBoat('small')}
                  className="bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white border border-orange-400/60 shadow-xs px-3 py-1.5 rounded-lg text-xs sm:text-sm font-extrabold transition-colors cursor-pointer"
                >
                  + Small (10)
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-1.5 sm:gap-2.5 items-start">
              {boats.map((boat, boatIndex) => {
                const numRows = boat.type === 'standard' ? 10 : 5;
                const weights = calculateBoatWeight(boat, memberMap);
                const round = (num: number) => Math.round(num * 10) / 10;
                const roundedL = round(weights.left);
                const roundedR = round(weights.right);
                const diff = round(roundedL - roundedR);
                const balText =
                  diff === 0 ? 'OK (0 kg)' : diff > 0 ? `L +${diff} kg` : `R +${Math.abs(diff)} kg`;
                const isUnbalanced = Math.abs(diff) > 10;

                const seatedInThisBoat = boat.seats.filter((s) => !!s.occupant).length;
                const maxCapacity = numRows * 2 + 2;

                const drummerSeat = boat.seats.find((s) => s.role === 'drummer') || {
                  role: 'drummer',
                  occupant: null,
                };
                const helmSeat = boat.seats.find((s) => s.role === 'helm') || {
                  role: 'helm',
                  occupant: null,
                };

                const drummerCollab = getSeatCollaborator(boat.id, 'drummer');
                const helmCollab = getSeatCollaborator(boat.id, 'helm');
                const drummerMember = drummerSeat.occupant
                  ? memberMap.get(drummerSeat.occupant)
                  : undefined;
                const helmMember = helmSeat.occupant
                  ? memberMap.get(helmSeat.occupant)
                  : undefined;

                return (
                  <div
                    key={boat.id}
                    id={boat.id}
                    data-type={boat.type}
                    className="boat-wrapper bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-1 py-1.5 sm:p-2.5 w-full"
                  >
                    {/* Boat Header */}
                    <div className="flex flex-wrap justify-between items-start gap-1 mb-1 pb-1 border-b border-zinc-200 dark:border-zinc-800 px-0.5">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display font-extrabold text-zinc-950 dark:text-white text-xs sm:text-base break-words leading-snug boat-title">
                          Boat {boatIndex + 1} ·{' '}
                          {boat.type === 'standard' ? 'Standard (20)' : 'Small (10)'}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1 text-[11px] sm:text-xs font-mono font-bold tabular-nums text-zinc-700 dark:text-zinc-200 mt-0.5 boat-date">
                          <span className="break-words">{displayDateStr || 'Unsaved'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="shrink-0">
                            {seatedInThisBoat}/{maxCapacity}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {onClearBoatSeats && seatedInThisBoat > 0 && (
                          <button
                            type="button"
                            onClick={() => onClearBoatSeats(boat.id)}
                            className="text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-[#14141b] p-1 sm:px-2 sm:py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="Clear Paddler Rows"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Reset</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onSaveBoatCanvas(boat.id)}
                          className="text-sky-700 dark:text-sky-300 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-[#14141b] p-1 sm:px-2 sm:py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                          title="Share Lineup Image"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Share</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveBoat(boat.id)}
                          className="text-red-600 dark:text-red-400 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-[#14141b] p-1 rounded-lg hover:bg-red-500/15 transition-colors cursor-pointer"
                          title="Remove Boat"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Column Labels */}
                    <div className="grid grid-cols-[12px_1fr_1fr] sm:grid-cols-[16px_1fr_1fr] gap-x-1 mb-1 text-[10px] sm:text-xs font-mono font-bold text-zinc-700 dark:text-zinc-200 text-center">
                      <div aria-hidden="true" />
                      <div>
                        <span className="sm:hidden">LEFT</span>
                        <span className="hidden sm:inline">PORT (LEFT)</span>
                      </div>
                      <div>
                        <span className="sm:hidden">RIGHT</span>
                        <span className="hidden sm:inline">STARBOARD (RIGHT)</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-[12px_1fr_1fr] sm:grid-cols-[16px_1fr_1fr] gap-x-1 gap-y-1.5">
                      {/* Coach / Drum — no word in the row number column */}
                      <div aria-hidden="true" />
                      <div
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropOnSeat(e, boat.id, 'drummer')}
                        onClick={() => handleBenchSeatInteraction(boat.id, drummerSeat)}
                        data-boat-id={boat.id}
                        data-role="drummer"
                        className={`col-span-2 droppable ${
                          drummerMember ? 'w-full' : 'seat drummer-helm'
                        } ${drummerCollab ? 'ring-2 ring-sky-400 rounded-md' : ''}`}
                      >
                        {drummerMember ? (
                          renderSeatNode(drummerMember, false, boat.id, drummerSeat)
                        ) : (
                          <span className="text-xs font-bold opacity-90">
                            <span className="sm:hidden">Coach / Drum</span>
                            <span className="hidden sm:inline">Coach / Drummer (Tap or Drop)</span>
                          </span>
                        )}
                      </div>

                      {/* Numbered Paddler Benches — plain compact row numbers without backing */}
                      {Array.from({ length: numRows }, (_, idx) => {
                        const rowNum = idx + 1;
                        const leftSeat = boat.seats.find(
                          (s) => s.row === rowNum && s.side === 'Left'
                        ) || {
                          row: rowNum,
                          side: 'Left' as const,
                          occupant: null,
                        };
                        const rightSeat = boat.seats.find(
                          (s) => s.row === rowNum && s.side === 'Right'
                        ) || {
                          row: rowNum,
                          side: 'Right' as const,
                          occupant: null,
                        };

                        const leftCollab = getSeatCollaborator(boat.id, undefined, rowNum, 'Left');
                        const rightCollab = getSeatCollaborator(
                          boat.id,
                          undefined,
                          rowNum,
                          'Right'
                        );
                        const leftMember = leftSeat.occupant
                          ? memberMap.get(leftSeat.occupant)
                          : undefined;
                        const rightMember = rightSeat.occupant
                          ? memberMap.get(rightSeat.occupant)
                          : undefined;

                        return (
                          <React.Fragment key={rowNum}>
                            <div className="flex items-center justify-center font-mono font-bold text-zinc-500 dark:text-zinc-400 text-[10px] sm:text-xs tabular-nums leading-none select-none">
                              {rowNum}
                            </div>
                            <div
                              onDragOver={handleDragOver}
                              onDrop={(e) =>
                                handleDropOnSeat(e, boat.id, undefined, rowNum, 'Left')
                              }
                              onClick={() => handleBenchSeatInteraction(boat.id, leftSeat)}
                              data-boat-id={boat.id}
                              data-row={rowNum}
                              data-side="Left"
                              className={`droppable ${leftMember ? 'w-full' : 'seat'} ${
                                leftCollab ? 'ring-2 ring-sky-400 rounded-md' : ''
                              }`}
                            >
                              {leftMember ? (
                                renderSeatNode(leftMember, false, boat.id, leftSeat)
                              ) : (
                                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-300">
                                  {rowNum}L
                                </span>
                              )}
                            </div>
                            <div
                              onDragOver={handleDragOver}
                              onDrop={(e) =>
                                handleDropOnSeat(e, boat.id, undefined, rowNum, 'Right')
                              }
                              onClick={() => handleBenchSeatInteraction(boat.id, rightSeat)}
                              data-boat-id={boat.id}
                              data-row={rowNum}
                              data-side="Right"
                              className={`droppable ${rightMember ? 'w-full' : 'seat'} ${
                                rightCollab ? 'ring-2 ring-sky-400 rounded-md' : ''
                              }`}
                            >
                              {rightMember ? (
                                renderSeatNode(rightMember, false, boat.id, rightSeat)
                              ) : (
                                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-300">
                                  {rowNum}R
                                </span>
                              )}
                            </div>
                          </React.Fragment>
                        );
                      })}

                      {/* Steer — no word in the row number column */}
                      <div aria-hidden="true" />
                      <div
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropOnSeat(e, boat.id, 'helm')}
                        onClick={() => handleBenchSeatInteraction(boat.id, helmSeat)}
                        data-boat-id={boat.id}
                        data-role="helm"
                        className={`col-span-2 droppable ${
                          helmMember ? 'w-full' : 'seat drummer-helm'
                        } ${helmCollab ? 'ring-2 ring-sky-400 rounded-md' : ''}`}
                      >
                        {helmMember ? (
                          renderSeatNode(helmMember, false, boat.id, helmSeat)
                        ) : (
                          <span className="text-xs font-bold opacity-90">
                            <span className="sm:hidden">Steer / Helm</span>
                            <span className="hidden sm:inline">Steer / Helm (Tap or Drop)</span>
                          </span>
                        )}
                      </div>

                      {/* Lateral Weight Telemetry Bar */}
                      <div className="col-start-2 col-span-2 mt-0.5 text-[11px] sm:text-sm flex items-center justify-between font-mono font-bold tabular-nums px-2 sm:px-3 py-1 bg-zinc-100 dark:bg-[#14141b] rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-950 dark:text-white boat-stats-bar">
                        <span>L:{roundedL}kg</span>
                        <span
                          className={`font-extrabold ${
                            isUnbalanced
                              ? 'text-red-700 dark:text-red-300'
                              : 'text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {balText}
                        </span>
                        <span>R:{roundedR}kg</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Touch-Drag Ghost Badge for Mobile */}
      {touchGhost && (
        <div
          style={{
            left: touchGhost.x,
            top: touchGhost.y - 28,
            transform: 'translate(-50%, -50%)',
          }}
          className="fixed z-[100] pointer-events-none px-3 py-1.5 rounded-lg bg-sky-600 text-white font-bold text-xs shadow-xl border border-white/40 max-w-[260px] break-words text-center"
        >
          {touchGhost.name}
        </div>
      )}
    </div>
  );
};
