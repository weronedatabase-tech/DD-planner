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
  SavedSessionSummary,
  CollaboratorPresence,
  SessionDeltaOp,
} from './types';
import {
  apiCall,
  ENV,
  FRONTEND_CONFIG,
  CollaborationManager,
  normalizeSessionAttendance,
} from './services/api';
import { RosterView } from './components/RosterView';
import { SessionView } from './components/SessionView';
import { BoatsView } from './components/BoatsView';
import { MemberModal } from './components/MemberModal';
import { DeleteModal } from './components/DeleteModal';
import { AssignModal } from './components/AssignModal';
import { InfoModal } from './components/InfoModal';
import { LinkModal } from './components/LinkModal';
import { ConfirmModal } from './components/ConfirmModal';
import { LoadingOverlay } from './components/LoadingOverlay';
import { runAutoBalanceBoats } from './utils/balancer';
import { generateBoatCanvasDataUrl, dataUrlToImageFile } from './utils/canvas';
import { formatDisplayDate } from './utils/date';
import {
  RefreshCw,
  ExternalLink,
  Users,
  Check,
  CloudUpload,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import logo192 from '../icon-192.png';
import logo512 from '../icon-512.png';

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('session');
  const [sessionSubTab, setSessionSubTab] = useState<SessionSubTab>('new');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // Default to black-based dark theme
  });

  const [roster, setRoster] = useState<Member[]>([]);
  const [currentSessionDate, setCurrentSessionDate] = useState<string | null>(null);
  const [sessionVersion, setSessionVersion] = useState<number>(1);
  const [attendance, setAttendance] = useState<string[]>([]);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [savedSessions, setSavedSessions] = useState<SavedSessionSummary[]>([]);

  // Collaborative Presence
  const [activeUsers, setActiveUsers] = useState<CollaboratorPresence[]>([]);
  const [clientId, setClientId] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
  const [exportedDataUrl, setExportedDataUrl] = useState<string>('');
  const [exportedFilename, setExportedFilename] = useState<string>('boat_lineup.jpg');

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // Refs for real-time reconciliation & delta batching
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deltaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingOpsRef = useRef<SessionDeltaOp[]>([]);
  const isRestoringRef = useRef<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const lastLocalEditTimeRef = useRef<number>(0);
  const collabRef = useRef<CollaborationManager | null>(null);
  const currentSessionDateRef = useRef<string | null>(null);
  const sessionVersionRef = useRef<number>(1);
  const attendanceRef = useRef<string[]>([]);
  const boatsRef = useRef<Boat[]>([]);
  const rosterRef = useRef<Member[]>([]);

  useEffect(() => {
    currentSessionDateRef.current = currentSessionDate;
  }, [currentSessionDate]);

  useEffect(() => {
    sessionVersionRef.current = sessionVersion;
  }, [sessionVersion]);

  useEffect(() => {
    attendanceRef.current = attendance;
  }, [attendance]);

  useEffect(() => {
    boatsRef.current = boats;
  }, [boats]);

  useEffect(() => {
    rosterRef.current = roster;
    // If a legacy session was loaded before roster arrived, resolve any numeric attendance indices now
    if (roster.length > 0) {
      setAttendance((prev) => {
        if (prev.some((item) => /^\d+$/.test(item))) {
          return normalizeSessionAttendance(prev, boats, roster);
        }
        return prev;
      });
    }
  }, [roster, boats]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

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

  // Restore State helper
  const restoreState = useCallback((data: SessionData) => {
    isRestoringRef.current = true;
    setCurrentSessionDate(data.date);
    currentSessionDateRef.current = data.date;
    if (data.version) {
      const ver = Number(data.version);
      setSessionVersion(ver);
      sessionVersionRef.current = ver;
    }

    const restoredBoats: Boat[] = (data.boats || []).map((b, idx) => {
      const numRows = b.type === 'standard' ? 10 : 5;
      const initialSeats: BoatSeat[] = [{ role: 'drummer', occupant: null }];
      for (let r = 1; r <= numRows; r++) {
        initialSeats.push({ row: r, side: 'Left', occupant: null });
        initialSeats.push({ row: r, side: 'Right', occupant: null });
      }
      initialSeats.push({ role: 'helm', occupant: null });

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
        id: b.id || `boat-${data.date || 'sess'}-${idx}`,
        type: b.type,
        seats: initialSeats,
      };
    });

    const restoredAttendance = normalizeSessionAttendance(
      data.attendance || [],
      restoredBoats,
      rosterRef.current
    );
    attendanceRef.current = restoredAttendance;
    boatsRef.current = restoredBoats;
    setAttendance(restoredAttendance);
    setBoats(restoredBoats);
    isRestoringRef.current = false;
  }, []);

  // Load roster from Google Sheet
  const loadRoster = useCallback(async () => {
    try {
      const data = await apiCall<Member[]>('getRosterData');
      const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
      setRoster(sorted);
    } catch (err: any) {
      console.error('Error loading roster:', err);
    }
  }, []);

  // Load sessions list from Google Sheet ('Sessions' tab)
  const loadSessionList = useCallback(async () => {
    try {
      const files = await apiCall<SavedSessionSummary[]>('listSessions');
      setSavedSessions(files || []);
      return files || [];
    } catch (err: any) {
      console.warn('Error loading sessions:', err);
      return [];
    }
  }, []);

  // Non-disruptive live data refresh from Google Sheet
  const handleRefreshAppData = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      if (!silent) {
        setIsLoading(true);
        setLoadingText('Syncing Latest Data from Sheet...');
      }
      try {
        await Promise.all([loadRoster(), loadSessionList()]);
        const activeDate = currentSessionDateRef.current;
        if (activeDate && Date.now() - lastLocalEditTimeRef.current >= 10000) {
          const raw = await apiCall<string | SessionData>('loadSessionFile', activeDate);
          if (raw) {
            const parsed: SessionData = typeof raw === 'string' ? JSON.parse(raw) : raw;
            restoreState(parsed);
          }
        }
        if (!silent) {
          showToast('Synced latest Roster & Sessions from Sheet');
        }
      } catch (err) {
        console.error('Refresh error:', err);
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [loadRoster, loadSessionList, restoreState, showToast]
  );

  // Initialize Real-Time Collaboration Manager & Auto-Sync on App Open
  useEffect(() => {
    let mounted = true;
    const manager = new CollaborationManager({
      onInit: (payload) => {
        if (!mounted) return;
        if (Array.isArray(payload.roster) && payload.roster.length > 0) {
          setRoster([...payload.roster].sort((a, b) => a.name.localeCompare(b.name)));
        }
        if (Array.isArray(payload.sessionsList)) {
          setSavedSessions(payload.sessionsList);
        }
        if (Array.isArray(payload.activeUsers)) {
          setActiveUsers(payload.activeUsers);
        }
      },
      onSessionUpdated: (incomingSession, senderId) => {
        if (!mounted) return;
        const myId = manager.getIdentity().clientId;
        if (senderId === myId) {
          if (incomingSession.version) {
            const ver = Number(incomingSession.version);
            setSessionVersion(ver);
            sessionVersionRef.current = ver;
          }
          return;
        }
        // Ignore stale or self-echoed remote syncs right after a local edit
        if (Date.now() - lastLocalEditTimeRef.current < 10000) {
          return;
        }
        if (
          incomingSession.version &&
          Number(incomingSession.version) <= sessionVersionRef.current
        ) {
          return;
        }
        // Only apply if for the currently active session
        if (
          currentSessionDateRef.current &&
          incomingSession.date === currentSessionDateRef.current
        ) {
          if (!isDraggingRef.current && pendingOpsRef.current.length === 0) {
            restoreState(incomingSession);
          }
        }
      },
      onSessionSwitched: (date, session) => {
        if (!mounted) return;
        if (
          session &&
          currentSessionDateRef.current &&
          currentSessionDateRef.current !== date
        ) {
          restoreState(session);
          showToast(`Session switched to ${formatDisplayDate(date)}`);
        }
      },
      onRosterUpdated: (updatedRoster) => {
        if (!mounted) return;
        setRoster([...updatedRoster].sort((a, b) => a.name.localeCompare(b.name)));
      },
      onPresenceUpdated: (users) => {
        if (!mounted) return;
        setActiveUsers(users);
      },
    });

    collabRef.current = manager;
    const ident = manager.getIdentity();
    setClientId(ident.clientId);

    // Auto-run full Sync immediately whenever the app is opened so the user always sees the latest info
    handleRefreshAppData();

    // Also auto-sync whenever the user reopens/focuses the app tab or PWA window
    const onVisibilityOrPageShow = () => {
      if (document.visibilityState === 'visible') {
        handleRefreshAppData({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityOrPageShow);
    window.addEventListener('pageshow', onVisibilityOrPageShow);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', onVisibilityOrPageShow);
      window.removeEventListener('pageshow', onVisibilityOrPageShow);
      manager.destroy();
    };
  }, [handleRefreshAppData, restoreState, showToast]);

  // Keep CollaborationManager context in sync
  useEffect(() => {
    collabRef.current?.setContext({
      activeTab,
      sessionDate: currentSessionDate,
      sessionVersion,
      selectedSeat: selectedSeatContext
        ? {
            boatId: selectedSeatContext.boatId,
            role: selectedSeatContext.seat.role,
            row: selectedSeatContext.seat.row,
            side: selectedSeatContext.seat.side,
          }
        : null,
    });
  }, [activeTab, currentSessionDate, sessionVersion, selectedSeatContext]);

  // Helper map
  const memberMap = new Map<string, Member>();
  roster.forEach((m) => memberMap.set(m.name, m));

  // Serialize current state from live refs so async callbacks always see the latest state
  const serializeState = useCallback((): SessionData => {
    return {
      date: currentSessionDateRef.current || currentSessionDate || '',
      attendance: attendanceRef.current,
      boats: boatsRef.current.map((b) => ({
        id: b.id,
        type: b.type,
        seats: b.seats.map((s) => ({
          role: s.role,
          row: s.row,
          side: s.side,
          occupant: s.occupant,
        })),
      })),
      version: sessionVersionRef.current,
    };
  }, [currentSessionDate]);

  // Execute Full Save to Google Sheet ('Sessions' tab)
  const executeSave = useCallback(
    async (overrideData?: SessionData) => {
      const data = overrideData || serializeState();
      if (!data.date) return;

      lastLocalEditTimeRef.current = Date.now();
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      setSaveStatus('saving');
      try {
        const saved = await apiCall<SessionData>('saveSessionToSheet', {
          dateStr: data.date,
          jsonContent: JSON.stringify(data),
          clientId: collabRef.current?.getIdentity().clientId,
        });
        if (saved?.version) {
          const ver = Number(saved.version);
          setSessionVersion(ver);
          sessionVersionRef.current = ver;
        }
        collabRef.current?.broadcastSessionUpdate(saved || data);
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

  // Queue atomic collaborative delta operation for instant multi-user sync
  const queueDelta = useCallback(
    (op: SessionDeltaOp, fallbackFullState?: SessionData) => {
      const targetDate = fallbackFullState?.date || currentSessionDateRef.current || currentSessionDate;
      if (!targetDate) return;

      lastLocalEditTimeRef.current = Date.now();
      pendingOpsRef.current.push(op);
      setSaveStatus('waiting');

      if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current);
      deltaTimerRef.current = setTimeout(async () => {
        const opsToSend = [...pendingOpsRef.current];
        pendingOpsRef.current = [];
        if (opsToSend.length === 0) return;

        lastLocalEditTimeRef.current = Date.now();
        const latestFullState = fallbackFullState || serializeState();
        setSaveStatus('saving');
        try {
          const updatedSession = await collabRef.current?.dispatchDelta(
            targetDate,
            opsToSend,
            latestFullState
          );
          if (updatedSession?.version) {
            const ver = Number(updatedSession.version);
            setSessionVersion(ver);
            sessionVersionRef.current = ver;
          }
          setSaveStatus('saved');
          setTimeout(() => {
            setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
          }, 1800);
        } catch (err) {
          console.error('Delta sync failed, falling back to full save:', err);
          await executeSave(latestFullState);
        }
      }, 40);
    },
    [currentSessionDate, executeSave, serializeState]
  );

  // Push to Undo
  const pushUndo = useCallback(() => {
    if (isRestoringRef.current) return;
    const current = JSON.stringify(serializeState());
    setUndoStack((prev) => {
      const next = [...prev, current];
      if (next.length > 30) next.shift();
      return next;
    });
    setRedoStack([]);
  }, [serializeState]);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const currentSnapshot = JSON.stringify(serializeState());
    const nextUndo = [...undoStack];
    const prevSnapshotStr = nextUndo.pop()!;
    setUndoStack(nextUndo);
    setRedoStack((prev) => [...prev, currentSnapshot]);

    try {
      const parsed: SessionData = JSON.parse(prevSnapshotStr);
      restoreState(parsed);
      queueDelta({ type: 'SET_FULL_STATE', state: parsed }, parsed);
    } catch (e) {
      console.error('Undo parse error', e);
    }
  }, [undoStack, serializeState, restoreState, queueDelta]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const currentSnapshot = JSON.stringify(serializeState());
    const nextRedo = [...redoStack];
    const nextSnapshotStr = nextRedo.pop()!;
    setRedoStack(nextRedo);
    setUndoStack((prev) => [...prev, currentSnapshot]);

    try {
      const parsed: SessionData = JSON.parse(nextSnapshotStr);
      restoreState(parsed);
      queueDelta({ type: 'SET_FULL_STATE', state: parsed }, parsed);
    } catch (e) {
      console.error('Redo parse error', e);
    }
  }, [redoStack, serializeState, restoreState, queueDelta]);

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  // Session management: create in Google Sheet
  const executeCreateSession = async (dateVal: string) => {
    setIsLoading(true);
    setLoadingText('Creating Session in Google Sheet...');
    try {
      setCurrentSessionDate(dateVal);
      setSessionVersion(1);
      setAttendance([]);
      setBoats([]);
      setUndoStack([]);
      setRedoStack([]);
      setSaveStatus('saving');

      const emptyState: SessionData = {
        date: dateVal,
        attendance: [],
        boats: [],
        version: 1,
      };
      await apiCall('saveSessionToSheet', {
        dateStr: dateVal,
        jsonContent: JSON.stringify(emptyState),
      });
      collabRef.current?.broadcastSessionSwitch(dateVal, emptyState);
      await loadSessionList();
      setSaveStatus('saved');
      showToast(`Created session ${formatDisplayDate(dateVal)}`);
    } catch (err: any) {
      console.error('Session create failed:', err);
      showToast('Failed to create session in Sheet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewSession = async (dateVal: string) => {
    setIsLoading(true);
    setLoadingText('Checking Google Sheet...');
    try {
      const exists = await apiCall<boolean>('checkSessionExists', dateVal);
      setIsLoading(false);
      if (exists) {
        setConfirmDialog({
          isOpen: true,
          title: 'Session Date Already Exists',
          description: `A session for ${formatDisplayDate(dateVal)} is already saved in the Google Sheet. Do you want to reset and overwrite it, or cancel and load the existing session?`,
          confirmLabel: 'Overwrite Session',
          variant: 'danger',
          onConfirm: () => {
            setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            executeCreateSession(dateVal);
          },
        });
        return;
      }
      await executeCreateSession(dateVal);
    } catch (err: any) {
      setIsLoading(false);
      console.error('Session check failed:', err);
    }
  };

  // Session management: load from Google Sheet
  const handleLoadSession = async (sessionId: string) => {
    if (!sessionId) return;
    setIsLoading(true);
    setLoadingText('Loading Session from Sheet...');
    try {
      const raw = await apiCall<string | SessionData>('loadSessionFile', sessionId);
      if (raw) {
        const data: SessionData = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!data.date) {
          data.date = String(sessionId).replace('.json', '').trim();
        }
        restoreState(data);
        setUndoStack([]);
        setRedoStack([]);
        setSaveStatus('idle');
        collabRef.current?.broadcastSessionSwitch(data.date, data);
        showToast(`Loaded session ${formatDisplayDate(data.date)}`);
      } else {
        throw new Error('Empty session response');
      }
    } catch (err: any) {
      console.error('Load session failed:', err);
      showToast('Could not load session from Sheet');
    } finally {
      setIsLoading(false);
    }
  };

  // Session management: delete from Google Sheet
  const handleDeleteSession = (sessionId: string) => {
    const cleanId = String(sessionId || '').replace('.json', '').trim();
    if (!cleanId) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Session',
      description: `Are you sure you want to permanently delete session ${formatDisplayDate(cleanId)}? This action cannot be undone.`,
      confirmLabel: 'Delete Session',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setIsLoading(true);
        setLoadingText('Deleting session...');
        try {
          await apiCall('deleteSession', cleanId);
          setSavedSessions((prev) =>
            prev.filter((s) => (s.rawDate || s.id) !== cleanId && s.id !== cleanId)
          );
          if (currentSessionDate === cleanId || currentSessionDateRef.current === cleanId) {
            currentSessionDateRef.current = null;
            attendanceRef.current = [];
            boatsRef.current = [];
            setCurrentSessionDate(null);
            setAttendance([]);
            setBoats([]);
            setUndoStack([]);
            setRedoStack([]);
            setSessionVersion(0);
          }
          await loadSessionList();
          showToast(`Deleted session ${formatDisplayDate(cleanId)}`);
        } catch (err) {
          console.error('Delete session error:', err);
          showToast('Could not delete session');
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  // Attendance toggling
  const handleAttendanceToggle = (memberName: string, isChecked: boolean) => {
    pushUndo();
    if (isChecked) {
      setAttendance((prev) => (prev.includes(memberName) ? prev : [...prev, memberName]));
    } else {
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
    queueDelta({ type: 'TOGGLE_ATTENDANCE', memberName, isChecked });
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
    queueDelta({ type: 'TOGGLE_GROUP', memberNames: groupMembers, isChecked });
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

    setBoats((prev) => {
      const next = [...prev, newBoat];
      boatsRef.current = next;
      return next;
    });
    queueDelta({ type: 'ADD_BOAT', boat: newBoat });
  };

  const handleRemoveBoat = (boatId: string) => {
    const boatIdx = boats.findIndex((b) => b.id === boatId);
    setConfirmDialog({
      isOpen: true,
      title: `Remove Boat ${boatIdx + 1}?`,
      description:
        'All members currently seated in this boat will be returned to the session pool.',
      confirmLabel: 'Remove Boat',
      variant: 'danger',
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        pushUndo();
        setBoats((prev) => {
          const next = prev.filter((b) => b.id !== boatId);
          boatsRef.current = next;
          return next;
        });
        queueDelta({ type: 'REMOVE_BOAT', boatId, boatIndex: boatIdx });
      },
    });
  };

  const handleClearBoatSeats = (boatId: string) => {
    pushUndo();
    setBoats((prev) => {
      const next = prev.map((b) => {
        if (b.id !== boatId) return b;
        return {
          ...b,
          seats: b.seats.map((s) =>
            s.row !== undefined ? { ...s, occupant: null } : s
          ),
        };
      });
      boatsRef.current = next;
      queueDelta({ type: 'SET_BOATS', boats: next });
      return next;
    });
  };

  // Auto-Balancing
  const handleRunAutoBalance = (mode: BalanceMode) => {
    if (boats.length === 0) return;
    pushUndo();
    const attendeeMembers = attendance
      .map((name) => memberMap.get(name))
      .filter((m): m is Member => !!m);

    const balancedBoats = runAutoBalanceBoats(boats, attendeeMembers, mode, memberMap);
    boatsRef.current = balancedBoats;
    setBoats(balancedBoats);
    queueDelta({ type: 'SET_BOATS', boats: balancedBoats });
    showToast(
      `Auto-balanced ${balancedBoats.length} boat${balancedBoats.length > 1 ? 's' : ''} (${
        mode === 'rocket' ? 'Rocket Engine' : 'Lateral Stability'
      })`
    );
  };

  // Drag and drop assignment (with seat-to-seat swap support!)
  const handleDropMemberToSeat = (
    memberName: string,
    targetBoatId: string,
    targetRole?: 'drummer' | 'helm',
    targetRow?: number,
    targetSide?: 'Left' | 'Right',
    fromBoatId?: string | null
  ) => {
    pushUndo();
    const targetBoatIndex = boatsRef.current.findIndex((b) => b.id === targetBoatId);
    const shouldSwap = Boolean(fromBoatId);

    const nextBoats = boatsRef.current.map((b) => ({
      ...b,
      seats: b.seats.map((s) => ({ ...s })),
    }));

    // Find previous seat of memberName in case we swap
    let prevBoatIdx = -1;
    let prevSeatIdx = -1;
    nextBoats.forEach((b, bIdx) => {
      b.seats.forEach((s, sIdx) => {
        if (s.occupant === memberName) {
          prevBoatIdx = bIdx;
          prevSeatIdx = sIdx;
        }
      });
    });

    // Clear memberName from previous seat
    nextBoats.forEach((b) => {
      b.seats.forEach((s) => {
        if (s.occupant === memberName) s.occupant = null;
      });
    });

    // Assign to target seat (and swap if occupied and dragged from another seat)
    nextBoats.forEach((b) => {
      if (b.id !== targetBoatId) return;
      b.seats.forEach((s) => {
        const isTarget = targetRole
          ? s.role === targetRole
          : Number(s.row) === Number(targetRow) && s.side === targetSide;
        if (isTarget) {
          const displaced = s.occupant;
          s.occupant = memberName;
          if (displaced && shouldSwap && prevBoatIdx !== -1 && prevSeatIdx !== -1) {
            nextBoats[prevBoatIdx].seats[prevSeatIdx].occupant = displaced;
          }
        }
      });
    });

    boatsRef.current = nextBoats;
    setBoats(nextBoats);

    queueDelta({
      type: 'ASSIGN_SEAT',
      memberName,
      targetBoatId,
      targetBoatIndex,
      targetRole,
      targetRow,
      targetSide,
      swapWithOccupant: shouldSwap,
    });
  };

  const handleDropMemberToPool = (memberName: string) => {
    pushUndo();
    const nextBoats = boatsRef.current.map((b) => ({
      ...b,
      seats: b.seats.map((s) => (s.occupant === memberName ? { ...s, occupant: null } : s)),
    }));
    boatsRef.current = nextBoats;
    setBoats(nextBoats);
    queueDelta({ type: 'RETURN_TO_POOL', memberName });
  };

  const handleReturnToPool = (boatId: string, seat: BoatSeat) => {
    if (!seat.occupant) return;
    const occName = seat.occupant;
    pushUndo();
    const nextBoats = boatsRef.current.map((b) => {
      if (b.id !== boatId) return b;
      return {
        ...b,
        seats: b.seats.map((s) => {
          const isMatch = s.role
            ? s.role === seat.role
            : Number(s.row) === Number(seat.row) && s.side === seat.side;
          return isMatch ? { ...s, occupant: null } : s;
        }),
      };
    });
    boatsRef.current = nextBoats;
    setBoats(nextBoats);
    queueDelta({ type: 'RETURN_TO_POOL', memberName: occName });
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

  // Share / Export boat canvas
  const handleSaveBoatCanvas = async (boatId: string) => {
    const boat = boats.find((b) => b.id === boatId);
    if (!boat) return;

    const boatIndex = boats.findIndex((b) => b.id === boatId);
    const boatTitle = `Boat ${boatIndex + 1} (${boat.type})`;
    const displayDate = formatDisplayDate(currentSessionDate);
    const filename = `${currentSessionDate || 'boat'}_${boatTitle.replace(/\s+/g, '_')}.jpg`;

    try {
      // Generate image and File synchronously to preserve browser user-gesture activation for navigator.share
      const dataUrl = generateBoatCanvasDataUrl(
        boat,
        boatTitle,
        displayDate,
        memberMap,
        isDarkMode
      );
      const imageFile = dataUrlToImageFile(dataUrl, filename);
      setExportedDataUrl(dataUrl);
      setExportedFilename(filename);

      // Save copy to Google Drive in the background (non-blocking)
      apiCall<{ id: string }>('saveBoatImageToDrive', {
        base64Data: dataUrl,
        filename,
      })
        .then((result) => {
          if (result?.id && !result.id.startsWith('local_preview')) {
            setDriveUrl(`https://drive.google.com/uc?export=view&id=${result.id}`);
          } else {
            setDriveUrl(dataUrl);
          }
        })
        .catch(() => {
          setDriveUrl(dataUrl);
        });

      // Directly open device's native "Share to other apps" sheet if supported
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          const shareData: ShareData = {
            files: [imageFile],
            title: `${boatTitle}${displayDate ? ` — ${displayDate}` : ''}`,
          };
          if (!navigator.canShare || navigator.canShare({ files: [imageFile] })) {
            await navigator.share(shareData);
            return;
          }
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') {
            // User dismissed the native share sheet
            return;
          }
        }
      }

      // Fallback modal if browser/device does not support native file sharing
      setDriveUrl(dataUrl);
      setIsLinkModalOpen(true);
    } catch (err: any) {
      console.error('Error sharing boat image:', err);
      showToast('Failed to generate boat image');
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
    collabRef.current?.broadcastRosterUpdate(updatedRoster);

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

    if (currentSessionDate) {
      executeSave();
    }

    const memberForServer = { ...memberToSave };
    if (String(memberForServer.rowIndex).startsWith('TEMP_')) {
      memberForServer.rowIndex = null;
    }

    try {
      await apiCall('saveMember', memberForServer);
      await loadRoster();
      showToast(`Saved ${memberToSave.name} to Google Sheet Roster`);
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

    setAttendance((prev) => prev.filter((n) => n !== p.name));
    setBoats((prev) =>
      prev.map((boat) => ({
        ...boat,
        seats: boat.seats.map((seat) =>
          seat.occupant === p.name ? { ...seat, occupant: null } : seat
        ),
      }))
    );

    const nextRoster = roster.filter((m) => m.name !== p.name);
    setRoster(nextRoster);
    collabRef.current?.broadcastRosterUpdate(nextRoster);

    if (currentSessionDate) {
      executeSave();
    }

    try {
      await apiCall('deleteMember', p.rowIndex);
      await loadRoster();
      showToast(`Removed ${p.name} from Roster`);
    } catch (err: any) {
      console.error('Delete member error:', err);
    }
  };

  const activeConfig = FRONTEND_CONFIG[ENV as keyof typeof FRONTEND_CONFIG];
  const sheetUrl = activeConfig?.SHEET_ID
    ? `https://docs.google.com/spreadsheets/d/${activeConfig.SHEET_ID}`
    : '#';

  const getSaveBtnProps = () => {
    switch (saveStatus) {
      case 'waiting':
        return {
          title: 'Changes queued to sync...',
          className:
            'bg-amber-500 hover:bg-amber-400 text-zinc-950 border-amber-300 ring-2 ring-amber-400/60 shadow-sm shadow-amber-500/30',
          dotClassName: 'bg-white animate-ping',
          disabled: false,
        };
      case 'saving':
        return {
          title: 'Saving to Google Sheet...',
          className:
            'bg-sky-500 text-white border-sky-300 ring-2 ring-sky-400/60 shadow-sm shadow-sky-500/30',
          dotClassName: 'bg-white animate-ping',
          disabled: true,
        };
      case 'saved':
        return {
          title: 'Saved',
          className:
            'bg-emerald-500 hover:bg-emerald-400 text-white border-emerald-300 ring-2 ring-emerald-400/70 shadow-sm shadow-emerald-500/40 scale-105',
          dotClassName: 'bg-white',
          disabled: false,
        };
      case 'error':
        return {
          title: 'Save failed — tap to retry',
          className:
            'bg-red-600 hover:bg-red-500 text-white border-red-400 ring-2 ring-red-500/70 shadow-sm shadow-red-600/40 animate-bounce',
          dotClassName: 'bg-red-200 animate-ping',
          disabled: false,
        };
      case 'idle':
      default:
        return {
          title: 'Save Session',
          className:
            'bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-300 dark:hover:bg-white',
          dotClassName: null,
          disabled: false,
        };
    }
  };

  const saveBtnProps = getSaveBtnProps();
  const onlineCount = Math.max(1, activeUsers.length);

  return (
    <div className="bg-zinc-50 dark:bg-black text-zinc-950 dark:text-zinc-50 select-none flex flex-col h-full w-full max-w-full overflow-x-hidden">
      {/* Main Top Bar (Strict 3-Zone Contract) */}
      <header className="flex-none z-30 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-4 px-2 sm:px-6 py-1.5 sm:py-2 bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800 w-full max-w-full overflow-hidden">
        {/* Zone 1: Brand Logo */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('session');
          }}
          className="justify-self-start flex items-center h-8 sm:h-10 overflow-hidden shrink-0 no-underline"
          title="Different Dragons"
        >
          <img
            src={logo192}
            srcSet={`${logo192} 192w, ${logo512} 512w`}
            sizes="(max-width: 640px) 96px, 140px"
            alt="Different Dragons"
            className="h-14 sm:h-18 w-auto max-w-[105px] sm:max-w-[160px] object-cover object-center dark:invert select-none pointer-events-none"
          />
        </a>

        {/* Zone 2: Primary Navigation Links */}
        <nav className="justify-self-center flex items-center gap-0.5 sm:gap-2 shrink-0">
          <div
            id="nav-roster"
            onClick={() => setActiveTab('roster')}
            className={`nav-btn ${
              activeTab === 'roster'
                ? 'active'
                : 'text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            Roster
          </div>
          <div
            id="nav-session"
            onClick={() => setActiveTab('session')}
            className={`nav-btn ${
              activeTab === 'session'
                ? 'active'
                : 'text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            Session
          </div>
          <div
            id="nav-planning"
            onClick={() => setActiveTab('planning')}
            className={`nav-btn ${
              activeTab === 'planning'
                ? 'active'
                : 'text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            Boats
          </div>
        </nav>

        {/* Zone 3: 1 Primary Action — Icon-only Save Button/Indicator */}
        <div className="justify-self-end flex items-center shrink-0">
          <button
            type="button"
            id="save-btn"
            disabled={saveBtnProps.disabled}
            onClick={() => executeSave()}
            title={saveBtnProps.title}
            aria-label={saveBtnProps.title}
            className={`relative justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg border transition-all duration-200 cursor-pointer flex items-center shrink-0 ${saveBtnProps.className}`}
          >
            {saveStatus === 'saved' ? (
              <Check className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[3] shrink-0" />
            ) : saveStatus === 'saving' ? (
              <Loader2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5] animate-spin shrink-0" />
            ) : saveStatus === 'waiting' ? (
              <RefreshCw className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5] animate-spin shrink-0" />
            ) : saveStatus === 'error' ? (
              <AlertTriangle className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5] shrink-0" />
            ) : (
              <CloudUpload className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.25] shrink-0" />
            )}
            {saveBtnProps.dotClassName && (
              <span
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${saveBtnProps.dotClassName}`}
              />
            )}
          </button>
        </div>
      </header>

      {/* Secondary Workspace Toolbar (Legend, Live Count, Sheet Link, Theme Toggle) */}
      <div className="flex-none bg-zinc-100 dark:bg-[#09090b] border-b border-zinc-200 dark:border-zinc-800 py-1.5 px-2 sm:px-6 z-20 flex md:grid md:grid-cols-[1fr_auto_1fr] items-center justify-between gap-1.5 sm:gap-3 text-xs sm:text-sm w-full max-w-full overflow-hidden">
        {/* Left: Sheet Link & Live Count */}
        <div className="justify-self-start flex items-center gap-2 sm:gap-3 shrink-0">
          {sheetUrl !== '#' && (
            <a
              id="sheet-link"
              href={sheetUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 rounded-md border transition-colors bg-white dark:bg-[#14141b] text-sky-700 dark:text-sky-300 border-zinc-300 dark:border-zinc-700 hover:border-sky-400 dark:hover:border-sky-500 flex items-center gap-1 sm:gap-1.5 no-underline whitespace-nowrap shrink-0"
            >
              <span>Sheet</span>
              <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            </a>
          )}

          {/* Live Count */}
          <div
            className="flex items-center gap-1 text-xs font-bold text-zinc-800 dark:text-zinc-100"
            title="Active users"
          >
            <Users className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <span className="font-mono tabular-nums">{onlineCount}</span>
          </div>
        </div>

        {/* Center: Role Color Key */}
        <div className="justify-self-center flex items-center gap-2.5 sm:gap-5 text-[11px] sm:text-xs font-bold text-zinc-800 dark:text-zinc-100 shrink-0">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-xs bg-[#e0f2fe] dark:bg-[#0a2540] border border-sky-500 shrink-0" />
            <span>Paddler</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-xs bg-[#d1fae5] dark:bg-[#062e22] border border-emerald-500 shrink-0" />
            <span>Volunteer</span>
          </div>
        </div>

        {/* Right: Sync Refresh & Theme Switch */}
        <div className="justify-self-end flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleRefreshAppData()}
            className="px-2.5 sm:px-3 py-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#14141b] hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            title="Sync Latest Data from Google Sheet"
          >
            <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span>Sync</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1 bg-transparent border-0 shadow-none text-base sm:text-lg leading-none hover:opacity-80 transition-opacity cursor-pointer"
            title="Toggle Theme"
          >
            🌗
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-grow overflow-hidden relative">
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
            onDeleteSession={handleDeleteSession}
            onGoToBoats={() => setActiveTab('planning')}
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
            activeUsers={activeUsers}
            currentClientId={clientId}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onAddBoat={handleAddBoat}
            onRemoveBoat={handleRemoveBoat}
            onClearBoatSeats={handleClearBoatSeats}
            onRunAutoBalance={handleRunAutoBalance}
            onShowAlgoInfo={() => setIsInfoModalOpen(true)}
            onSaveBoatCanvas={handleSaveBoatCanvas}
            onSeatClick={handleSeatClick}
            onReturnToPool={handleReturnToPool}
            onDropMemberToSeat={handleDropMemberToSeat}
            onDropMemberToPool={handleDropMemberToPool}
            onDragStateChange={(dragging) => {
              isDraggingRef.current = dragging;
            }}
          />
        )}

        {/* Non-Intrusive Live Collaboration Toast */}
        {toastMessage && (
          <div className="fixed bottom-4 right-4 z-50 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 px-4 py-2.5 rounded-lg shadow-lg text-xs sm:text-sm font-bold pointer-events-none">
            {toastMessage}
          </div>
        )}
      </main>

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
        dataUrl={exportedDataUrl}
        filename={exportedFilename}
      />

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      <LoadingOverlay isLoading={isLoading} message={loadingText} />
    </div>
  );
};
