import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Member,
  Boat,
  BoatSeat,
  ActiveTab,
  SessionSubTab,
  SaveStatus,
  BalanceMode,
  SessionData,
} from './types';
import { apiCall, ENV, FRONTEND_CONFIG } from './services/api';
import { RosterView } from './components/RosterView';
import { SessionView } from './components/SessionView';
import { BoatsView } from './components/BoatsView';
import { MemberModal } from './components/MemberModal';
import { DeleteModal } from './components/DeleteModal';
import { AssignModal } from './components/AssignModal';
import { InfoModal } from './components/InfoModal';
import { LinkModal } from './components/LinkModal';
import { LoadingOverlay } from './components/LoadingOverlay';
import { runAutoBalanceBoats } from './utils/balancer';
import { generateBoatCanvasDataUrl } from './utils/canvas';
import { formatDisplayDate } from './utils/date';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('session');
  const [sessionSubTab, setSessionSubTab] = useState<SessionSubTab>('new');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  const [roster, setRoster] = useState<Member[]>([]);
  const [currentSessionDate, setCurrentSessionDate] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<string[]>([]);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [savedSessions, setSavedSessions] = useState<{ id: string; name: string }[]>([]);

  // Undo / Redo
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // Save status & loading
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>('Loading...');

  // Modals state
  const [isMemberModalOpen, setIsMemberModalOpen] = useState<boolean>(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [selectedSeatContext, setSelectedSeatContext] = useState<{
    boatId: string;
    seat: BoatSeat;
  } | null>(null);

  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const [driveUrl, setDriveUrl] = useState<string>('#');

  // Timer ref for debounced autosave
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRestoringRef = useRef<boolean>(false);

  // Sync theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Handle window unload check
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (autosaveTimerRef.current || saveStatus === 'saving' || saveStatus === 'waiting') {
        e.preventDefault();
        e.returnValue = 'Changes are not yet saved. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

  // Load roster
  const loadRoster = useCallback(async () => {
    try {
      const data = await apiCall<Member[]>('getRosterData');
      const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
      setRoster(sorted);
    } catch (err: any) {
      console.error('Error loading roster:', err);
    }
  }, []);

  // Load sessions list
  const loadSessionList = useCallback(async () => {
    try {
      const files = await apiCall<{ id: string; name: string }[]>('listSessions');
      setSavedSessions(files || []);
    } catch (err: any) {
      console.warn('Error loading sessions:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadRoster();
    loadSessionList();
  }, [loadRoster, loadSessionList]);

  // Helper map
  const memberMap = new Map<string, Member>();
  roster.forEach((m) => memberMap.set(m.name, m));

  // Serialize current state
  const serializeState = useCallback((): SessionData => {
    return {
      date: currentSessionDate || '',
      attendance: attendance,
      boats: boats.map((b) => ({
        type: b.type,
        seats: b.seats.map((s) => ({
          role: s.role,
          row: s.row,
          side: s.side,
          occupant: s.occupant,
        })),
      })),
    };
  }, [currentSessionDate, attendance, boats]);

  // Execute Save
  const executeSave = useCallback(
    async (overrideData?: SessionData) => {
      const data = overrideData || serializeState();
      if (!data.date) return;

      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      setSaveStatus('saving');
      try {
        await apiCall('saveSessionToDrive', {
          dateStr: data.date,
          jsonContent: JSON.stringify(data),
        });
        setSaveStatus('saved');
        setTimeout(() => {
          setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
        }, 2000);
      } catch (err) {
        console.error('Save failed:', err);
        setSaveStatus('error');
      }
    },
    [serializeState]
  );

  // Trigger Autosave
  const triggerAutosave = useCallback(
    (customData?: SessionData) => {
      if (!currentSessionDate) return;
      setSaveStatus('waiting');
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(() => {
        executeSave(customData);
      }, 2000);
    },
    [currentSessionDate, executeSave]
  );

  // Push to Undo
  const pushUndo = useCallback(() => {
    if (isRestoringRef.current) return;
    const current = JSON.stringify(serializeState());
    setUndoStack((prev) => {
      const next = [...prev, current];
      if (next.length > 20) next.shift();
      return next;
    });
    setRedoStack([]);
  }, [serializeState]);

  // Restore State
  const restoreState = useCallback((data: SessionData) => {
    isRestoringRef.current = true;
    setCurrentSessionDate(data.date);
    const restoredAttendance = (data.attendance || []).map(String);
    setAttendance(restoredAttendance);

    const restoredBoats: Boat[] = (data.boats || []).map((b, idx) => {
      const numRows = b.type === 'standard' ? 10 : 5;
      const initialSeats: BoatSeat[] = [
        { role: 'drummer', occupant: null },
      ];
      for (let r = 1; r <= numRows; r++) {
        initialSeats.push({ row: r, side: 'Left', occupant: null });
        initialSeats.push({ row: r, side: 'Right', occupant: null });
      }
      initialSeats.push({ role: 'helm', occupant: null });

      // Merge saved seats
      (b.seats || []).forEach((savedSeat) => {
        if (!savedSeat.occupant) return;
        if (savedSeat.role) {
          const match = initialSeats.find((s) => s.role === savedSeat.role);
          if (match) match.occupant = savedSeat.occupant;
        } else if (savedSeat.row && savedSeat.side) {
          const match = initialSeats.find(
            (s) => s.row === Number(savedSeat.row) && s.side === savedSeat.side
          );
          if (match) match.occupant = savedSeat.occupant;
        }
      });

      return {
        id: `boat-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        type: b.type,
        seats: initialSeats,
      };
    });

    setBoats(restoredBoats);
    isRestoringRef.current = false;
  }, []);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const currentSnapshot = JSON.stringify(serializeState());
    const nextUndo = [...undoStack];
    const prevSnapshotStr = nextUndo.pop()!;
    setUndoStack(nextUndo);
    setRedoStack((prev) => [...prev, currentSnapshot]);

    try {
      const parsed = JSON.parse(prevSnapshotStr);
      restoreState(parsed);
      triggerAutosave(parsed);
    } catch (e) {
      console.error('Undo parse error', e);
    }
  }, [undoStack, serializeState, restoreState, triggerAutosave]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const currentSnapshot = JSON.stringify(serializeState());
    const nextRedo = [...redoStack];
    const nextSnapshotStr = nextRedo.pop()!;
    setRedoStack(nextRedo);
    setUndoStack((prev) => [...prev, currentSnapshot]);

    try {
      const parsed = JSON.parse(nextSnapshotStr);
      restoreState(parsed);
      triggerAutosave(parsed);
    } catch (e) {
      console.error('Redo parse error', e);
    }
  }, [redoStack, serializeState, restoreState, triggerAutosave]);

  // Session management: create
  const handleCreateNewSession = async (dateVal: string) => {
    setIsLoading(true);
    setLoadingText('Checking date...');
    try {
      const exists = await apiCall<boolean>('checkSessionExists', dateVal);
      if (exists) {
        setIsLoading(false);
        if (!confirm(`A session for ${dateVal} already exists. Overwrite?`)) {
          return;
        }
        setIsLoading(true);
        setLoadingText('Creating Session...');
      }

      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      setCurrentSessionDate(dateVal);
      setAttendance([]);
      setBoats([]);
      setUndoStack([]);
      setRedoStack([]);
      setSaveStatus('idle');

      const emptyState: SessionData = { date: dateVal, attendance: [], boats: [] };
      await apiCall('saveSessionToDrive', {
        dateStr: dateVal,
        jsonContent: JSON.stringify(emptyState),
      });
      loadSessionList();
    } catch (err: any) {
      console.error('Session create failed:', err);
      alert('Session check/create failed: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Session management: load
  const handleLoadSession = async (sessionId: string) => {
    if (!sessionId) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    setIsLoading(true);
    setLoadingText('Loading Data...');
    try {
      const json = await apiCall<string>('loadSessionFile', sessionId);
      if (json && json.trim()) {
        const data = JSON.parse(json);
        restoreState(data);
        setUndoStack([]);
        setRedoStack([]);
        setSaveStatus('idle');
      }
    } catch (err: any) {
      console.error('Load session failed:', err);
      alert('Failed to load session: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Attendance toggling
  const handleAttendanceToggle = (memberName: string, isChecked: boolean) => {
    pushUndo();
    if (isChecked) {
      setAttendance((prev) => (prev.includes(memberName) ? prev : [...prev, memberName]));
    } else {
      // Uncheck attendee: remove from attendance AND remove from any boat seats!
      setAttendance((prev) => prev.filter((n) => n !== memberName));
      setBoats((prev) =>
        prev.map((boat) => ({
          ...boat,
          seats: boat.seats.map((seat) =>
            seat.occupant === memberName ? { ...seat, occupant: null } : seat
          ),
        }))
      );
    }
    triggerAutosave();
  };

  const handleToggleGroup = (type: 'Paddler' | 'Volunteer', isChecked: boolean) => {
    pushUndo();
    const groupMembers = roster.filter((m) => m.type === type).map((m) => m.name);
    if (isChecked) {
      setAttendance((prev) => Array.from(new Set([...prev, ...groupMembers])));
    } else {
      setAttendance((prev) => prev.filter((name) => !groupMembers.includes(name)));
      setBoats((prev) =>
        prev.map((boat) => ({
          ...boat,
          seats: boat.seats.map((seat) =>
            seat.occupant && groupMembers.includes(seat.occupant)
              ? { ...seat, occupant: null }
              : seat
          ),
        }))
      );
    }
    triggerAutosave();
  };

  // Boat management
  const handleAddBoat = (type: 'standard' | 'small') => {
    pushUndo();
    const numRows = type === 'standard' ? 10 : 5;
    const initialSeats: BoatSeat[] = [{ role: 'drummer', occupant: null }];
    for (let r = 1; r <= numRows; r++) {
      initialSeats.push({ row: r, side: 'Left', occupant: null });
      initialSeats.push({ row: r, side: 'Right', occupant: null });
    }
    initialSeats.push({ role: 'helm', occupant: null });

    const newBoat: Boat = {
      id: `boat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      seats: initialSeats,
    };

    setBoats((prev) => [...prev, newBoat]);
    triggerAutosave();
  };

  const handleRemoveBoat = (boatId: string) => {
    pushUndo();
    setBoats((prev) => prev.filter((b) => b.id !== boatId));
    triggerAutosave();
  };

  // Auto-Balancing
  const handleRunAutoBalance = (mode: BalanceMode) => {
    if (boats.length === 0) return;
    pushUndo();
    const attendeeMembers = attendance
      .map((name) => memberMap.get(name))
      .filter((m): m is Member => !!m);

    const balancedBoats = runAutoBalanceBoats(boats, attendeeMembers, mode, memberMap);
    setBoats(balancedBoats);
    triggerAutosave();
  };

  // Drag and drop assignment
  const handleDropMemberToSeat = (
    memberName: string,
    targetBoatId: string,
    targetRole?: 'drummer' | 'helm',
    targetRow?: number,
    targetSide?: 'Left' | 'Right'
  ) => {
    pushUndo();
    setBoats((prevBoats) => {
      return prevBoats.map((b) => {
        // If this boat contains the previous seat of memberName, clear that seat
        let nextSeats = b.seats.map((s) => {
          if (s.occupant === memberName) {
            return { ...s, occupant: null };
          }
          return s;
        });

        // If this is the target boat, assign memberName to target seat
        if (b.id === targetBoatId) {
          nextSeats = nextSeats.map((s) => {
            const isTarget = targetRole
              ? s.role === targetRole
              : s.row === targetRow && s.side === targetSide;
            if (isTarget) {
              return { ...s, occupant: memberName };
            }
            return s;
          });
        }

        return { ...b, seats: nextSeats };
      });
    });
    triggerAutosave();
  };

  const handleDropMemberToPool = (memberName: string) => {
    pushUndo();
    setBoats((prevBoats) =>
      prevBoats.map((b) => ({
        ...b,
        seats: b.seats.map((s) => (s.occupant === memberName ? { ...s, occupant: null } : s)),
      }))
    );
    triggerAutosave();
  };

  const handleReturnToPool = (boatId: string, seat: BoatSeat) => {
    pushUndo();
    setBoats((prevBoats) =>
      prevBoats.map((b) => {
        if (b.id !== boatId) return b;
        return {
          ...b,
          seats: b.seats.map((s) => {
            const isMatch = s.role ? s.role === seat.role : s.row === seat.row && s.side === seat.side;
            return isMatch ? { ...s, occupant: null } : s;
          }),
        };
      })
    );
    triggerAutosave();
  };

  // Seat click / Assign modal
  const handleSeatClick = (boatId: string, seat: BoatSeat) => {
    setSelectedSeatContext({ boatId, seat });
    setIsAssignModalOpen(true);
  };

  const handleAssignFromModal = (memberName: string) => {
    if (!selectedSeatContext) return;
    const { boatId, seat } = selectedSeatContext;
    handleDropMemberToSeat(memberName, boatId, seat.role, seat.row, seat.side);
  };

  const handleClearSeatFromModal = () => {
    if (!selectedSeatContext) return;
    const { boatId, seat } = selectedSeatContext;
    handleReturnToPool(boatId, seat);
  };

  // Export boat canvas
  const handleSaveBoatCanvas = async (boatId: string) => {
    const boat = boats.find((b) => b.id === boatId);
    if (!boat) return;

    const boatIndex = boats.findIndex((b) => b.id === boatId);
    const boatTitle = `Boat ${boatIndex + 1} (${boat.type})`;
    const displayDate = formatDisplayDate(currentSessionDate);

    try {
      const dataUrl = generateBoatCanvasDataUrl(boat, boatTitle, displayDate, memberMap);
      const filename = `${currentSessionDate || 'boat'}_${boatTitle.replace(/\s+/g, '_')}.jpg`;

      const result = await apiCall<{ id: string }>('saveBoatImageToDrive', {
        base64Data: dataUrl,
        filename,
      });

      if (result.id && !result.id.startsWith('local_preview')) {
        setDriveUrl(`https://drive.google.com/uc?export=view&id=${result.id}`);
      } else {
        // Fallback local download / preview
        setDriveUrl(dataUrl);
      }
      setIsLinkModalOpen(true);
    } catch (err: any) {
      console.error('Error generating boat image:', err);
      alert('Canvas error: ' + err.message);
    }
  };

  // Member CRUD
  const handleOpenAddMember = () => {
    setEditingMember(null);
    setIsMemberModalOpen(true);
  };

  const handleOpenEditMember = (member: Member) => {
    setEditingMember(member);
    setIsMemberModalOpen(true);
  };

  const handleSaveMember = async (memberToSave: Member) => {
    setIsMemberModalOpen(false);
    const oldName = editingMember?.name;
    const isNew = !memberToSave.rowIndex;

    let updatedRoster = [...roster];
    if (!isNew) {
      const idx = updatedRoster.findIndex(
        (m) => String(m.rowIndex) === String(memberToSave.rowIndex)
      );
      if (idx !== -1) updatedRoster[idx] = memberToSave;
    } else {
      memberToSave.rowIndex = 'TEMP_' + Date.now();
      updatedRoster.push(memberToSave);
    }

    // Update reciprocal links
    const linkedNames = memberToSave.volunteers
      ? memberToSave.volunteers.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const myName = memberToSave.name;

    updatedRoster = updatedRoster.map((r) => {
      if (String(r.rowIndex) === String(memberToSave.rowIndex)) return r;
      let otherLinks = r.volunteers
        ? r.volunteers.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      let modified = false;

      if (linkedNames.includes(r.name)) {
        if (!otherLinks.includes(myName)) {
          otherLinks.push(myName);
          modified = true;
        }
      } else if (otherLinks.includes(myName)) {
        otherLinks = otherLinks.filter((n) => n !== myName);
        modified = true;
      }

      if (modified) {
        return { ...r, volunteers: otherLinks.join(',') };
      }
      return r;
    });

    updatedRoster.sort((a, b) => a.name.localeCompare(b.name));
    setRoster(updatedRoster);

    // If member renamed, update attendance and boats
    if (oldName && oldName !== memberToSave.name) {
      setAttendance((prev) =>
        prev.map((n) => (n === oldName ? memberToSave.name : n))
      );
      setBoats((prev) =>
        prev.map((boat) => ({
          ...boat,
          seats: boat.seats.map((seat) =>
            seat.occupant === oldName ? { ...seat, occupant: memberToSave.name } : seat
          ),
        }))
      );
    }

    // Trigger save
    if (currentSessionDate) {
      executeSave();
    }

    // Persist to server
    const memberForServer = { ...memberToSave };
    if (String(memberForServer.rowIndex).startsWith('TEMP_')) {
      memberForServer.rowIndex = null;
    }

    try {
      await apiCall('saveMember', memberForServer);
      loadRoster();
    } catch (err: any) {
      console.error('Save member error:', err);
    }
  };

  const handleOpenDeleteMember = (member: Member) => {
    setMemberToDelete(member);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!memberToDelete) return;
    const p = memberToDelete;
    setIsDeleteModalOpen(false);

    // Remove from attendance and boats
    setAttendance((prev) => prev.filter((n) => n !== p.name));
    setBoats((prev) =>
      prev.map((boat) => ({
        ...boat,
        seats: boat.seats.map((seat) =>
          seat.occupant === p.name ? { ...seat, occupant: null } : seat
        ),
      }))
    );

    setRoster((prev) => prev.filter((m) => m.name !== p.name));

    if (currentSessionDate) {
      executeSave();
    }

    try {
      await apiCall('deleteMember', p.rowIndex);
      loadRoster();
    } catch (err: any) {
      console.error('Delete member error:', err);
    }
  };

  // Refresh app data button
  const handleRefreshAppData = () => {
    if (saveStatus === 'saving' || saveStatus === 'waiting') {
      if (!confirm('Saving is in progress. Reloading now might lose unsaved changes. Continue?')) {
        return;
      }
    }
    window.location.reload();
  };

  const activeConfig = FRONTEND_CONFIG[ENV as keyof typeof FRONTEND_CONFIG];
  const sheetUrl = activeConfig?.SHEET_ID
    ? `https://docs.google.com/spreadsheets/d/${activeConfig.SHEET_ID}`
    : '#';

  // Save button styling based on status
  const getSaveBtnProps = () => {
    switch (saveStatus) {
      case 'waiting':
        return {
          text: 'Waiting...',
          className: 'bg-amber-100 text-amber-700 border-amber-200',
          disabled: false,
        };
      case 'saving':
        return {
          text: 'Saving...',
          className: 'bg-blue-100 text-blue-700 border-blue-200',
          disabled: true,
        };
      case 'saved':
        return {
          text: 'Saved',
          className: 'bg-green-100 text-green-700 border-green-200',
          disabled: false,
        };
      case 'error':
        return {
          text: 'Retry Save',
          className: 'bg-red-100 text-red-700 border-red-200',
          disabled: false,
        };
      case 'idle':
      default:
        return {
          text: 'Save Now',
          className:
            'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-gray-600',
          disabled: false,
        };
    }
  };

  const saveBtnProps = getSaveBtnProps();

  return (
    <div className="bg-bg-light dark:bg-bg-dark text-gray-900 dark:text-gray-100 select-none flex flex-col h-full w-full">
      {/* Dev Mode Banner */}
      {ENV === 'DEV' && (
        <div className="flex-none bg-red-600 text-white text-center text-xs font-bold py-1 z-50">
          DEV MODE
        </div>
      )}

      {/* Main Top Header */}
      <div className="flex-none shadow z-30 flex text-sm items-center justify-between p-2 relative gap-2 bg-surface-light dark:bg-surface-dark bg-white dark:bg-gray-800">
        <img
          src="https://drive.google.com/thumbnail?id=1zWXle0f60eKYSKMrlyUbfU8OyKJ_9oju&sz=h100"
          referrerPolicy="no-referrer"
          alt="Logo"
          className="h-10 w-auto rounded object-contain"
        />
        <div className="flex w-full gap-1">
          <div
            id="nav-roster"
            onClick={() => setActiveTab('roster')}
            className={`nav-btn ${activeTab === 'roster' ? 'active' : ''}`}
          >
            Roster
          </div>
          <div
            id="nav-session"
            onClick={() => setActiveTab('session')}
            className={`nav-btn ${activeTab === 'session' ? 'active' : ''}`}
          >
            Session
          </div>
          <div
            id="nav-planning"
            onClick={() => setActiveTab('planning')}
            className={`nav-btn ${activeTab === 'planning' ? 'active' : ''}`}
          >
            Boats
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="ml-2 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer"
          title="Toggle Theme"
        >
          🌗
        </button>
      </div>

      {/* Sub Header */}
      <div className="flex-none bg-white dark:bg-gray-900 border-b dark:border-gray-700 py-1 px-3 relative shadow-sm z-20 flex items-center justify-end h-10 gap-3">
        {sheetUrl !== '#' && (
          <a
            id="sheet-link"
            href={sheetUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-none text-[10px] font-bold px-3 py-1 rounded border transition-colors bg-white text-blue-600 border-blue-200 hover:bg-blue-50 dark:bg-gray-700 dark:text-blue-300 dark:border-gray-600 z-10 no-underline"
          >
            Open Sheet
          </a>
        )}

        <div className="flex-grow flex justify-center gap-6 text-[10px] font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5 text-[#1e3a8a] dark:text-[#bfdbfe]">
            <div className="w-3 h-3 rounded-sm bg-[#bfdbfe] border border-[#60a5fa] dark:bg-[#1e3a8a] dark:border-[#1d4ed8]" />
            Paddler
          </div>
          <div className="flex items-center gap-1.5 text-[#14532d] dark:text-[#bbf7d0]">
            <div className="w-3 h-3 rounded-sm bg-[#bbf7d0] border border-[#4ade80] dark:bg-[#14532d] dark:border-[#15803d]" />
            Volunteer
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefreshAppData}
          className="cursor-pointer hover:opacity-80 transition-opacity z-10 p-0 bg-transparent border-0"
          title="Update App & Refresh Data"
        >
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#22c55e', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <path
              d="M4 12C4 16.4183 7.58172 20 12 20C14.5656 20 16.8481 18.7877 18.2868 16.9038M19.918 13C19.9729 12.6738 20 12.3397 20 12C20 7.58172 16.4183 4 12 4C9.56557 4 7.3779 5.09758 5.88235 6.82353"
              stroke="url(#grad1)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M16 16.5L18.5 16.5L18.5 19"
              stroke="url(#grad1)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8 7.5L5.5 7.5L5.5 5"
              stroke="url(#grad1)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button
          type="button"
          id="save-btn"
          disabled={saveBtnProps.disabled}
          onClick={() => executeSave()}
          className={`flex-none text-[10px] font-bold px-3 py-1 rounded border transition-colors cursor-pointer ${saveBtnProps.className}`}
        >
          {saveBtnProps.text}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow overflow-hidden relative">
        {activeTab === 'roster' && (
          <RosterView
            roster={roster}
            onAddMember={handleOpenAddMember}
            onEditMember={handleOpenEditMember}
            onDeleteMember={handleOpenDeleteMember}
          />
        )}

        {activeTab === 'session' && (
          <SessionView
            sessionSubTab={sessionSubTab}
            onSubTabChange={setSessionSubTab}
            currentSessionDate={currentSessionDate}
            savedSessions={savedSessions}
            roster={roster}
            attendance={attendance}
            onAttendanceToggle={handleAttendanceToggle}
            onToggleGroup={handleToggleGroup}
            onCreateNewSession={handleCreateNewSession}
            onLoadSession={handleLoadSession}
          />
        )}

        {activeTab === 'planning' && (
          <BoatsView
            boats={boats}
            roster={roster}
            attendance={attendance}
            currentSessionDate={currentSessionDate}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onAddBoat={handleAddBoat}
            onRemoveBoat={handleRemoveBoat}
            onRunAutoBalance={handleRunAutoBalance}
            onShowAlgoInfo={() => setIsInfoModalOpen(true)}
            onSaveBoatCanvas={handleSaveBoatCanvas}
            onSeatClick={handleSeatClick}
            onReturnToPool={handleReturnToPool}
            onDropMemberToSeat={handleDropMemberToSeat}
            onDropMemberToPool={handleDropMemberToPool}
          />
        )}
      </div>

      {/* Modals & Overlays */}
      <MemberModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        onSave={handleSaveMember}
        member={editingMember}
        allMembers={roster}
      />

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        memberName={memberToDelete ? memberToDelete.name : ''}
      />

      <AssignModal
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false);
          setSelectedSeatContext(null);
        }}
        seat={selectedSeatContext?.seat || null}
        boatId={selectedSeatContext?.boatId || null}
        attendingMembers={attendance
          .map((n) => memberMap.get(n))
          .filter((m): m is Member => !!m)}
        seatedNames={
          new Set(
            boats.flatMap((b) =>
              b.seats.filter((s) => s.occupant).map((s) => s.occupant!)
            )
          )
        }
        onAssign={handleAssignFromModal}
        onClearSeat={handleClearSeatFromModal}
      />

      <InfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} />

      <LinkModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        driveUrl={driveUrl}
      />

      <LoadingOverlay isLoading={isLoading} message={loadingText} />
    </div>
  );
};
