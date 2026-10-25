import {
  Member,
  Boat,
  SessionData,
  SavedSessionSummary,
  CollaboratorPresence,
  SessionDeltaOp,
  ActiveTab,
} from '../types';
import { formatDisplayDate } from '../utils/date';

export const ENV: 'PROD' | 'DEV' = 'PROD';
export const API_URL =
  'https://script.google.com/macros/s/AKfycbw2IQxPX-Mn3Zy-8-YNHOrfOjsDGGWIBb0-xLp9g3DM1zcv4-DgsjhRG9RR0bc20Q1U/exec';

export const FRONTEND_CONFIG = {
  PROD: {
    SHEET_ID: '1JKHOx-53BbL3XfP1RqYQ7QLmb2vg1q_rlvnXda5ervw',
  },
  DEV: {
    SHEET_ID: '11l1q5YSfAtp897hPvNgb8Ak7DXmJ6l7FJ9mV6QniEDY',
  },
};

export const DEFAULT_SAMPLE_ROSTER: Member[] = [
  { rowIndex: 2, name: 'Alex Wong', type: 'Paddler', side: 'Left', gender: 'M', weight: 78, active: true, volunteers: 'Sam Chen' },
  { rowIndex: 3, name: 'Sam Chen', type: 'Volunteer', side: 'Right', gender: 'F', weight: 62, active: true, volunteers: 'Alex Wong' },
  { rowIndex: 4, name: 'Marcus Taylor', type: 'Paddler', side: 'Right', gender: 'M', weight: 85, active: true, volunteers: 'Sarah Jenkins' },
  { rowIndex: 5, name: 'Sarah Jenkins', type: 'Volunteer', side: 'Left', gender: 'F', weight: 60, active: true, volunteers: 'Marcus Taylor' },
  { rowIndex: 6, name: 'David Kim', type: 'Paddler', side: 'Left', gender: 'M', weight: 74, active: true, volunteers: 'Emily Watson' },
  { rowIndex: 7, name: 'Emily Watson', type: 'Volunteer', side: 'Any', gender: 'F', weight: 58, active: true, volunteers: 'David Kim' },
  { rowIndex: 8, name: 'Jason Lee', type: 'Paddler', side: 'Right', gender: 'M', weight: 82, active: true, volunteers: '' },
  { rowIndex: 9, name: 'Michael Tan', type: 'Paddler', side: 'Left', gender: 'M', weight: 90, active: true, volunteers: '' },
  { rowIndex: 10, name: 'Chris Evans', type: 'Volunteer', side: 'Right', gender: 'M', weight: 80, active: true, volunteers: '' },
  { rowIndex: 11, name: 'Jessica Alba', type: 'Volunteer', side: 'Left', gender: 'F', weight: 59, active: true, volunteers: '' },
  { rowIndex: 12, name: 'Oliver Twist', type: 'Paddler', side: 'Any', gender: 'M', weight: 70, active: true, volunteers: '' },
  { rowIndex: 13, name: 'Hannah Abbott', type: 'Volunteer', side: 'Any', gender: 'F', weight: 64, active: true, volunteers: '' },
  { rowIndex: 14, name: 'Ryan Gosling', type: 'Paddler', side: 'Right', gender: 'M', weight: 81, active: true, volunteers: '' },
  { rowIndex: 15, name: 'Emma Stone', type: 'Volunteer', side: 'Right', gender: 'F', weight: 55, active: true, volunteers: '' },
  { rowIndex: 16, name: 'Tom Holland', type: 'Paddler', side: 'Left', gender: 'M', weight: 68, active: true, volunteers: '' },
  { rowIndex: 17, name: 'Zendaya Coleman', type: 'Volunteer', side: 'Left', gender: 'F', weight: 57, active: true, volunteers: '' },
  { rowIndex: 18, name: 'Daniel Craig', type: 'Paddler', side: 'Right', gender: 'M', weight: 86, active: true, volunteers: '' },
  { rowIndex: 19, name: 'Rachel Weisz', type: 'Volunteer', side: 'Right', gender: 'F', weight: 61, active: true, volunteers: '' },
  { rowIndex: 20, name: 'Liam Neeson', type: 'Paddler', side: 'Left', gender: 'M', weight: 92, active: true, volunteers: '' },
  { rowIndex: 21, name: 'Laura Linney', type: 'Volunteer', side: 'Left', gender: 'F', weight: 63, active: true, volunteers: '' },
  { rowIndex: 22, name: 'Morgan Freeman', type: 'Paddler', side: 'Right', gender: 'M', weight: 79, active: true, volunteers: '' },
  { rowIndex: 23, name: 'Helen Mirren', type: 'Volunteer', side: 'Any', gender: 'F', weight: 65, active: true, volunteers: '' },
];

const COLLAB_COLORS = [
  '#38bdf8',
  '#34d399',
  '#f59e0b',
  '#a78bfa',
  '#fb7185',
  '#2dd4bf',
  '#60a5fa',
];

export function getClientIdentity(): { clientId: string; name: string; color: string } {
  let clientId = sessionStorage.getItem('dd_client_id');
  if (!clientId) {
    clientId = 'c_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    sessionStorage.setItem('dd_client_id', clientId);
  }
  let name = localStorage.getItem('dd_collab_name');
  if (!name) {
    const num = Math.floor(10 + Math.random() * 89);
    name = `Coach #${num}`;
    localStorage.setItem('dd_collab_name', name);
  }
  let color = localStorage.getItem('dd_collab_color');
  if (!color) {
    color = COLLAB_COLORS[Math.floor(Math.random() * COLLAB_COLORS.length)];
    localStorage.setItem('dd_collab_color', color);
  }
  return { clientId, name, color };
}

export function setCollaboratorName(newName: string): string {
  const clean = newName.trim().slice(0, 24) || 'Coach';
  localStorage.setItem('dd_collab_name', clean);
  return clean;
}

// Normalize legacy numeric attendance indices (from Drive migration) into actual member names
export function normalizeSessionAttendance(
  rawAttendance: (string | number)[],
  boats: Boat[] = [],
  roster: Member[] = []
): string[] {
  const sortedRoster =
    roster.length > 0 ? [...roster].sort((a, b) => a.name.localeCompare(b.name)) : [];
  const nameSet = new Set(roster.map((m) => m.name));
  const resolved: string[] = [];

  for (const item of rawAttendance || []) {
    const str = String(item ?? '').trim();
    if (!str) continue;
    if (nameSet.has(str)) {
      resolved.push(str);
    } else if (/^\d+$/.test(str) && sortedRoster.length > 0) {
      const idx = Number(str);
      if (idx >= 0 && idx < sortedRoster.length && sortedRoster[idx]?.name) {
        resolved.push(sortedRoster[idx].name);
      } else {
        resolved.push(str);
      }
    } else {
      resolved.push(str);
    }
  }

  // Ensure any member seated in a boat is also included in attendance
  for (const boat of boats || []) {
    for (const seat of boat.seats || []) {
      if (seat.occupant && typeof seat.occupant === 'string' && seat.occupant.trim()) {
        resolved.push(seat.occupant.trim());
      }
    }
  }

  return Array.from(new Set(resolved));
}

// In-memory + localStorage mirror for instant session reads
const memorySessionsTable: Record<string, SessionData> = {};

function getLocalSessionsSheetTable(): Record<string, SessionData> {
  try {
    const raw = localStorage.getItem('dd_sheets_sessions_table');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...parsed, ...memorySessionsTable };
    }
  } catch {}
  return { ...memorySessionsTable };
}

function saveLocalSessionsSheetTable(table: Record<string, SessionData>) {
  Object.assign(memorySessionsTable, table);
  try {
    localStorage.setItem('dd_sheets_sessions_table', JSON.stringify(table));
  } catch {}
}

// Direct high-speed read from Google Sheet Visualization JSON endpoint (CORS-enabled, ~200ms, no GAS rate limit)
async function fetchSheetGvizTable(sheetName: string): Promise<any[] | null> {
  const sheetId = FRONTEND_CONFIG[ENV].SHEET_ID;
  if (!sheetId) return null;
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
      sheetName
    )}&_=${Date.now()}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(tid);
    if (!res.ok) return null;
    const txt = await res.text();
    const start = txt.indexOf('{');
    const end = txt.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    const parsed = JSON.parse(txt.substring(start, end + 1));
    return parsed?.table?.rows || null;
  } catch {
    return null;
  }
}

async function fetchRosterFromSheetDirect(): Promise<Member[] | null> {
  const rows = await fetchSheetGvizTable('Roster');
  if (!rows || rows.length === 0) return null;
  const roster: Member[] = [];
  rows.forEach((r: any, idx: number) => {
    const c = r?.c || [];
    const name = c[0]?.v ? String(c[0].v).trim() : '';
    if (!name || name.toLowerCase() === 'name') return;
    const rawType = c[1]?.v ? String(c[1].v).trim() : 'Paddler';
    const rawGender = c[2]?.v ? String(c[2].v).trim() : 'M';
    const rawWeight = Number(c[3]?.v) || 0;
    const rawSide = c[4]?.v ? String(c[4].v).trim() : 'Any';
    const rawActive = c[5]?.v !== false && String(c[5]?.v).toLowerCase() !== 'false';
    const rawVol = c[6]?.v ? String(c[6].v).trim() : '';
    roster.push({
      rowIndex: idx + 2,
      name,
      type: rawType === 'Volunteer' ? 'Volunteer' : 'Paddler',
      gender: rawGender === 'F' ? 'F' : 'M',
      weight: rawWeight,
      side: rawSide === 'Left' || rawSide === 'Right' ? rawSide : 'Any',
      active: rawActive,
      volunteers: rawVol,
    });
  });
  if (roster.length > 0) {
    try {
      localStorage.setItem('dd_roster_cache', JSON.stringify(roster));
    } catch {}
    return roster;
  }
  return null;
}

export function normalizeBoatSeatsClient(b: any, idx: number, dateStr: string): Boat {
  const type: 'standard' | 'small' = b?.type === 'small' ? 'small' : 'standard';
  const numRows = type === 'standard' ? 10 : 5;
  const canonicalSeats: Boat['seats'] = [{ role: 'drummer', occupant: null }];
  for (let r = 1; r <= numRows; r++) {
    canonicalSeats.push({ row: r, side: 'Left', occupant: null });
    canonicalSeats.push({ row: r, side: 'Right', occupant: null });
  }
  canonicalSeats.push({ role: 'helm', occupant: null });

  if (Array.isArray(b?.seats)) {
    for (const savedSeat of b.seats) {
      if (!savedSeat || !savedSeat.occupant) continue;
      if (savedSeat.role) {
        const match = canonicalSeats.find((s) => s.role === savedSeat.role);
        if (match) match.occupant = String(savedSeat.occupant);
      } else if (savedSeat.row !== undefined && savedSeat.side) {
        const match = canonicalSeats.find(
          (s) => Number(s.row) === Number(savedSeat.row) && s.side === savedSeat.side
        );
        if (match) match.occupant = String(savedSeat.occupant);
      }
    }
  }

  return {
    id: b?.id || `boat-${dateStr || 'sess'}-${idx}`,
    type,
    seats: canonicalSeats,
  };
}

const localMutationTimestamps: Record<string, number> = {};
const deletedSessionTimestamps: Record<string, number> = {};

export function markLocalSessionMutation(dateStr: string | null | undefined) {
  if (!dateStr) return;
  localMutationTimestamps[dateStr] = Date.now();
  delete deletedSessionTimestamps[dateStr];
}

export function wasRecentlyMutatedLocally(dateStr: string | null | undefined, windowMs = 25000): boolean {
  if (!dateStr) return false;
  const ts = localMutationTimestamps[dateStr] || 0;
  return Date.now() - ts < windowMs;
}

export function wasRecentlyDeletedLocally(dateStr: string | null | undefined, windowMs = 90000): boolean {
  if (!dateStr) return false;
  const ts = deletedSessionTimestamps[dateStr] || 0;
  return Date.now() - ts < windowMs;
}

async function fetchSessionsFromSheetDirect(): Promise<{
  list: SavedSessionSummary[];
  table: Record<string, SessionData>;
} | null> {
  const rows = await fetchSheetGvizTable('Sessions');
  if (!rows) return null;
  const list: SavedSessionSummary[] = [];
  const table = getLocalSessionsSheetTable();
  const seenIds = new Set<string>();

  for (const r of rows) {
    const c = r?.c || [];
    let rawDate = c[0]?.v ? String(c[0]?.v).trim().replace(/^'/, '') : '';
    if (!rawDate || rawDate.toLowerCase() === 'session date') continue;
    if (wasRecentlyDeletedLocally(rawDate)) {
      delete table[rawDate];
      delete memorySessionsTable[rawDate];
      continue;
    }
    const displayDate = c[1]?.v ? String(c[1].v) : formatDisplayDate(rawDate);
    const updatedAt = c[2]?.v ? String(c[2].v) : '';
    const version = Number(c[3]?.v) || 1;
    const updatedBy = c[4]?.v ? String(c[4].v) : '';
    const attendanceCount = Number(c[5]?.v) || 0;
    const boatsSummary = c[6]?.v ? String(c[6].v) : '';
    const jsonCell = c[8]?.v ? String(c[8].v) : '';

    if (jsonCell) {
      try {
        const parsed: SessionData = JSON.parse(jsonCell);
        const key = parsed.date || rawDate;
        if (wasRecentlyDeletedLocally(key)) {
          delete table[key];
          delete memorySessionsTable[key];
          continue;
        }
        const existing = table[key];
        // Overwrite local session cache with latest Sheet data unless mutated locally very recently
        if (!existing || !wasRecentlyMutatedLocally(key, 25000)) {
          table[key] = {
            ...parsed,
            date: key,
            boats: Array.isArray(parsed.boats)
              ? parsed.boats.map((b, idx) => normalizeBoatSeatsClient(b, idx, key))
              : [],
            version: Number(parsed.version) || version,
            updatedAt: parsed.updatedAt || updatedAt,
            updatedBy: parsed.updatedBy || updatedBy,
          };
        }
      } catch {}
    }

    if (!seenIds.has(rawDate)) {
      seenIds.add(rawDate);
      list.push({
        id: rawDate,
        name: displayDate,
        rawDate,
        updatedAt,
        version,
        updatedBy,
        attendanceCount,
        boatsSummary,
      });
    }
  }

  // Only keep local sessions that are in the Sheet or were just created/mutated locally
  for (const [key, localSess] of Object.entries(table)) {
    if (!key || wasRecentlyDeletedLocally(key)) {
      delete table[key];
      delete memorySessionsTable[key];
      continue;
    }
    if (!seenIds.has(key)) {
      if (wasRecentlyMutatedLocally(key, 60000)) {
        seenIds.add(key);
        list.push({
          id: key,
          name: formatDisplayDate(key) || key,
          rawDate: key,
          updatedAt: localSess.updatedAt || '',
          version: localSess.version || 1,
          updatedBy: localSess.updatedBy || '',
          attendanceCount: (localSess.attendance || []).length,
        });
      } else {
        delete table[key];
        delete memorySessionsTable[key];
      }
    }
  }

  saveLocalSessionsSheetTable(table);
  list.sort((a, b) => (b.rawDate || b.id).localeCompare(a.rawDate || a.id));
  return { list, table };
}

export function applyLocalDelta(session: SessionData, ops: SessionDeltaOp[], author: string): SessionData {
  let attendance = [...(session.attendance || []).map(String)];
  let boats = (session.boats || []).map((b, idx) =>
    normalizeBoatSeatsClient(b, idx, session.date)
  );

  for (const op of ops) {
    if (op.type === 'TOGGLE_ATTENDANCE') {
      if (op.isChecked) {
        if (!attendance.includes(op.memberName)) attendance.push(op.memberName);
      } else {
        attendance = attendance.filter((n) => n !== op.memberName);
        boats = boats.map((b) => ({
          ...b,
          seats: b.seats.map((s) =>
            s.occupant === op.memberName ? { ...s, occupant: null } : s
          ),
        }));
      }
    } else if (op.type === 'TOGGLE_GROUP') {
      if (op.isChecked) {
        op.memberNames.forEach((n) => {
          if (!attendance.includes(n)) attendance.push(n);
        });
      } else {
        attendance = attendance.filter((n) => !op.memberNames.includes(n));
        boats = boats.map((b) => ({
          ...b,
          seats: b.seats.map((s) =>
            s.occupant && op.memberNames.includes(s.occupant) ? { ...s, occupant: null } : s
          ),
        }));
      }
    } else if (op.type === 'ADD_BOAT') {
      if (!boats.some((b) => b.id === op.boat.id)) {
        boats.push(normalizeBoatSeatsClient(op.boat, boats.length, session.date));
      }
    } else if (op.type === 'REMOVE_BOAT') {
      boats = boats.filter((b, i) => (op.boatId && b.id ? b.id !== op.boatId : i !== op.boatIndex));
    } else if (op.type === 'ASSIGN_SEAT') {
      const { memberName, targetBoatId, targetBoatIndex, targetRole, targetRow, targetSide, swapWithOccupant } = op;
      let prevBoatIdx = -1;
      let prevSeatIdx = -1;
      boats.forEach((b, bIdx) => {
        b.seats.forEach((s, sIdx) => {
          if (s.occupant === memberName) {
            prevBoatIdx = bIdx;
            prevSeatIdx = sIdx;
          }
        });
      });

      boats.forEach((b) => {
        b.seats.forEach((s) => {
          if (s.occupant === memberName) s.occupant = null;
        });
      });

      let assigned = false;
      boats.forEach((b, bIdx) => {
        const isTarget = (targetBoatId && b.id === targetBoatId) || bIdx === targetBoatIndex;
        if (!isTarget) return;
        b.seats.forEach((s) => {
          const isMatch = targetRole
            ? s.role === targetRole
            : Number(s.row) === Number(targetRow) && s.side === targetSide;
          if (isMatch) {
            const displaced = s.occupant;
            s.occupant = memberName;
            assigned = true;
            if (displaced && swapWithOccupant && prevBoatIdx !== -1 && prevSeatIdx !== -1) {
              boats[prevBoatIdx].seats[prevSeatIdx].occupant = displaced;
            }
          }
        });
      });

      if (!assigned && boats.length > 0) {
        const fallbackBoat =
          boats[typeof targetBoatIndex === 'number' && targetBoatIndex >= 0 ? targetBoatIndex : 0] ||
          boats[0];
        if (fallbackBoat) {
          fallbackBoat.seats.forEach((s) => {
            const isMatch = targetRole
              ? s.role === targetRole
              : Number(s.row) === Number(targetRow) && s.side === targetSide;
            if (isMatch) {
              const displaced = s.occupant;
              s.occupant = memberName;
              if (displaced && swapWithOccupant && prevBoatIdx !== -1 && prevSeatIdx !== -1) {
                boats[prevBoatIdx].seats[prevSeatIdx].occupant = displaced;
              }
            }
          });
        }
      }
    } else if (op.type === 'RETURN_TO_POOL') {
      boats.forEach((b) => {
        b.seats.forEach((s) => {
          if (s.occupant === op.memberName) s.occupant = null;
        });
      });
    } else if (op.type === 'SET_BOATS') {
      boats = op.boats.map((b, idx) => normalizeBoatSeatsClient(b, idx, session.date));
    } else if (op.type === 'SET_FULL_STATE') {
      attendance = (op.state.attendance || []).map(String);
      boats = (op.state.boats || []).map((b, i) =>
        normalizeBoatSeatsClient(b, i, session.date)
      );
    }
  }

  return {
    date: session.date,
    attendance,
    boats,
    version: (Number(session.version) || 0) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: author,
  };
}

let localServerAvailable: boolean | null =
  typeof window !== 'undefined' &&
  (window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:')
    ? false
    : null;

let activeForegroundCalls = 0;

const clientGasSaveTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const pendingGasSaves: Record<string, SessionData> = {};

function flushPendingGasSave(dateStr: string, useKeepalive = false) {
  if (clientGasSaveTimers[dateStr]) {
    clearTimeout(clientGasSaveTimers[dateStr]);
    delete clientGasSaveTimers[dateStr];
  }
  const latest = pendingGasSaves[dateStr] || getLocalSessionsSheetTable()[dateStr];
  if (!latest) return;
  delete pendingGasSaves[dateStr];

  const payload = JSON.stringify({
    action: 'saveSessionToSheet',
    data: {
      dateStr,
      jsonContent: JSON.stringify(latest),
      updatedBy: latest.updatedBy || getClientIdentity().name,
    },
  });

  if (useKeepalive) {
    try {
      fetch(API_URL, {
        method: 'POST',
        redirect: 'follow',
        body: payload,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        keepalive: true,
      }).catch(() => {});
    } catch {}
    return;
  }

  (async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 600 * attempt));
        }
        // Always read the very latest local snapshot in case newer edits happened before retry
        const currentLatest = getLocalSessionsSheetTable()[dateStr] || latest;
        const res = await fetch(API_URL, {
          method: 'POST',
          redirect: 'follow',
          body: JSON.stringify({
            action: 'saveSessionToSheet',
            data: {
              dateStr,
              jsonContent: JSON.stringify(currentLatest),
              updatedBy: currentLatest.updatedBy || getClientIdentity().name,
            },
          }),
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        });
        const json = await res.json();
        if (json?.status === 'success') {
          markLocalSessionMutation(dateStr);
          break;
        }
      } catch {
        // Ignore background network hiccups; data is safely persisted in localStorage & retried on next save
      }
    }
  })();
}

function scheduleClientBackgroundGasSave(dateStr: string, record: SessionData) {
  pendingGasSaves[dateStr] = record;
  if (clientGasSaveTimers[dateStr]) {
    clearTimeout(clientGasSaveTimers[dateStr]);
  }
  clientGasSaveTimers[dateStr] = setTimeout(() => {
    flushPendingGasSave(dateStr, false);
  }, 300);
}

if (typeof window !== 'undefined') {
  const flushAllOnUnload = () => {
    Object.keys(pendingGasSaves).forEach((dateStr) => {
      flushPendingGasSave(dateStr, true);
    });
  };
  window.addEventListener('pagehide', flushAllOnUnload);
  window.addEventListener('beforeunload', flushAllOnUnload);
}

export async function apiCall<T = any>(action: string, data: any = {}): Promise<T> {
  const isBackgroundSync = action === 'syncState';
  if (!isBackgroundSync) {
    activeForegroundCalls++;
  }

  try {
    // 1. Try local full-stack Express + Google Sheet sync endpoint first if available (AI Studio preview)
    if (localServerAvailable !== false) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 5000);
        const localRes = await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, data }),
          signal: controller.signal,
        });
        clearTimeout(t);
        if (localRes.ok) {
          localServerAvailable = true;
          const json = await localRes.json();
          if (json.status === 'success') {
            mirrorToLocalStorage(action, data, json.data);
            return json.data as T;
          }
        } else if (localServerAvailable === null || localRes.status === 405 || localRes.status === 404) {
          if (localServerAvailable === null) {
            localServerAvailable = false;
          }
        }
      } catch {
        if (localServerAvailable === null) {
          localServerAvailable = false;
        }
      }
    }

    // 2. Instant Write Fast-Path on GitHub Pages / static hosting:
    // Commit immediately to memory + localStorage (~1ms) so UI save is instant,
    // and flush to Google Sheets via Google Apps Script asynchronously in the background.
    if (action === 'saveSessionToSheet' || action === 'saveSessionToDrive') {
      const { dateStr, jsonContent, updatedBy } = data;
      const cleanDate = String(dateStr || '').replace('.json', '').trim();
      const table = getLocalSessionsSheetTable();
      const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
      const prevVer = table[cleanDate]?.version || 0;
      const rawBoats = Array.isArray(parsed?.boats) ? parsed.boats : [];
      const record: SessionData = {
        ...parsed,
        date: cleanDate,
        attendance: Array.isArray(parsed?.attendance) ? parsed.attendance.map(String) : [],
        boats: rawBoats.map((b: any, i: number) => normalizeBoatSeatsClient(b, i, cleanDate)),
        version: Math.max(prevVer + 1, (Number(parsed?.version) || 0) + 1),
        updatedAt: new Date().toISOString(),
        updatedBy: updatedBy || parsed?.updatedBy || getClientIdentity().name,
      };
      table[cleanDate] = record;
      saveLocalSessionsSheetTable(table);
      markLocalSessionMutation(cleanDate);
      scheduleClientBackgroundGasSave(cleanDate, record);
      return record as unknown as T;
    }

    if (action === 'applySessionDelta') {
      const dateStr = String(data.date || '').trim();
      const table = getLocalSessionsSheetTable();
      const current: SessionData = data.fullState ||
        table[dateStr] || {
          date: dateStr,
          attendance: [],
          boats: [],
          version: 0,
        };
      const ops: SessionDeltaOp[] = Array.isArray(data.ops) ? data.ops : [data.op];
      const updated: SessionData = data.fullState
        ? {
            ...data.fullState,
            date: dateStr,
            boats: Array.isArray(data.fullState.boats)
              ? data.fullState.boats.map((b: any, i: number) =>
                  normalizeBoatSeatsClient(b, i, dateStr)
                )
              : [],
            version: Math.max(table[dateStr]?.version || 0, Number(data.fullState.version) || 0) + 1,
            updatedAt: new Date().toISOString(),
            updatedBy: data.updatedBy || getClientIdentity().name,
          }
        : applyLocalDelta(current, ops, data.updatedBy || getClientIdentity().name);
      table[dateStr] = updated;
      saveLocalSessionsSheetTable(table);
      markLocalSessionMutation(dateStr);
      scheduleClientBackgroundGasSave(dateStr, updated);
      return { session: updated, activeUsers: [] } as unknown as T;
    }

    if (action === 'deleteSession') {
      const cleanDate = String(data || '').replace('.json', '').trim();
      if (clientGasSaveTimers[cleanDate]) {
        clearTimeout(clientGasSaveTimers[cleanDate]);
        delete clientGasSaveTimers[cleanDate];
      }
      delete pendingGasSaves[cleanDate];
      deletedSessionTimestamps[cleanDate] = Date.now();
      delete localMutationTimestamps[cleanDate];
      const table = getLocalSessionsSheetTable();
      delete table[cleanDate];
      delete memorySessionsTable[cleanDate];
      saveLocalSessionsSheetTable(table);
      try {
        localStorage.removeItem(`dd_session_${cleanDate}`);
      } catch {}

      (async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            if (attempt > 0) await new Promise((r) => setTimeout(r, 800 * attempt));
            const res = await fetch(API_URL, {
              method: 'POST',
              redirect: 'follow',
              body: JSON.stringify({ action: 'deleteSession', data: cleanDate }),
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            });
            const json = await res.json();
            if (json.status === 'success') break;
          } catch {}
        }
      })();

      return { deleted: true, date: cleanDate } as unknown as T;
    }

    // 3. Fast-path for read operations on GitHub Pages / static hosting:
    // Use direct Google Sheets gviz read in parallel or ahead of GAS to avoid GAS cold-start / rate-limiting
    if (action === 'listSessions') {
      const direct = await fetchSessionsFromSheetDirect();
      if (direct) {
        return direct.list as unknown as T;
      }
    }

    if (action === 'loadSessionFile' || action === 'loadSession') {
      const cleanDate = String(data || '').replace('.json', '').trim();
      const cachedTable = getLocalSessionsSheetTable();
      if (
        wasRecentlyMutatedLocally(cleanDate, 25000) &&
        cachedTable[cleanDate] &&
        ((cachedTable[cleanDate].attendance && cachedTable[cleanDate].attendance.length > 0) ||
          (cachedTable[cleanDate].boats && cachedTable[cleanDate].boats.length > 0))
      ) {
        return JSON.stringify(cachedTable[cleanDate]) as unknown as T;
      }
      const direct = await fetchSessionsFromSheetDirect();
      if (direct && direct.table[cleanDate]) {
        return JSON.stringify(direct.table[cleanDate]) as unknown as T;
      }
      if (
        cachedTable[cleanDate] &&
        ((cachedTable[cleanDate].attendance && cachedTable[cleanDate].attendance.length > 0) ||
          (cachedTable[cleanDate].boats && cachedTable[cleanDate].boats.length > 0))
      ) {
        return JSON.stringify(cachedTable[cleanDate]) as unknown as T;
      }
    }

    if (action === 'getRosterData') {
      const directRoster = await fetchRosterFromSheetDirect();
      if (directRoster && directRoster.length > 0) {
        return directRoster as unknown as T;
      }
    }

    // 4. Call Google Apps Script Web App directly (with retry for transient GAS concurrency limits)
    const maxAttempts = isBackgroundSync ? 1 : 2;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 700 * attempt));
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 14000);

        const response = await fetch(API_URL, {
          method: 'POST',
          redirect: 'follow',
          body: JSON.stringify({ action, data }),
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const result = await response.json();
        if (result.status === 'success') {
          mirrorToLocalStorage(action, data, result.data);
          return result.data as T;
        } else {
          throw new Error(result.message || 'API returned failure status');
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    // 5. Offline / Google Sheet fallback mirror
    return await handleOfflineSheetFallback<T>(action, data, lastError);
  } finally {
    if (!isBackgroundSync) {
      activeForegroundCalls = Math.max(0, activeForegroundCalls - 1);
    }
  }
}

function mirrorToLocalStorage(action: string, reqData: any, resData: any) {
  try {
    if (action === 'getRosterData' && Array.isArray(resData)) {
      localStorage.setItem('dd_roster_cache', JSON.stringify(resData));
    } else if (action === 'deleteSession') {
      const cleanDate = String(reqData || resData?.date || '').replace('.json', '').trim();
      if (cleanDate) {
        if (clientGasSaveTimers[cleanDate]) {
          clearTimeout(clientGasSaveTimers[cleanDate]);
          delete clientGasSaveTimers[cleanDate];
        }
        delete pendingGasSaves[cleanDate];
        deletedSessionTimestamps[cleanDate] = Date.now();
        delete localMutationTimestamps[cleanDate];
        const table = getLocalSessionsSheetTable();
        delete table[cleanDate];
        delete memorySessionsTable[cleanDate];
        saveLocalSessionsSheetTable(table);
        localStorage.removeItem(`dd_session_${cleanDate}`);
      }
    } else if (action === 'listSessions' && Array.isArray(resData)) {
      const table = getLocalSessionsSheetTable();
      let updated = false;
      for (const item of resData) {
        if (item?.sessionJson && typeof item.sessionJson === 'string') {
          try {
            const parsed = JSON.parse(item.sessionJson);
            const key = parsed.date || item.rawDate || item.id;
            if (key && !wasRecentlyDeletedLocally(key)) {
              table[key] = parsed;
              updated = true;
            }
          } catch {}
        }
      }
      if (updated) {
        saveLocalSessionsSheetTable(table);
      }
    } else if (
      (action === 'saveSessionToSheet' || action === 'saveSessionToDrive') &&
      reqData?.dateStr
    ) {
      const table = getLocalSessionsSheetTable();
      const parsed =
        typeof reqData.jsonContent === 'string'
          ? JSON.parse(reqData.jsonContent)
          : reqData.jsonContent;
      table[reqData.dateStr] = {
        ...parsed,
        date: reqData.dateStr,
        version: resData?.version || (table[reqData.dateStr]?.version || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      saveLocalSessionsSheetTable(table);
    } else if (action === 'applySessionDelta' && resData?.session) {
      const table = getLocalSessionsSheetTable();
      table[resData.session.date] = resData.session;
      saveLocalSessionsSheetTable(table);
    } else if ((action === 'loadSessionFile' || action === 'loadSession') && resData) {
      const parsed = typeof resData === 'string' ? JSON.parse(resData) : resData;
      if (parsed?.date) {
        const table = getLocalSessionsSheetTable();
        table[parsed.date] = parsed;
        saveLocalSessionsSheetTable(table);
      }
    }
  } catch {}
}

async function handleOfflineSheetFallback<T>(action: string, data: any, error: any): Promise<T> {
  if (action === 'getRosterData') {
    const directRoster = await fetchRosterFromSheetDirect();
    if (directRoster && directRoster.length > 0) {
      return directRoster as unknown as T;
    }
    const cached = localStorage.getItem('dd_roster_cache');
    if (cached) {
      try {
        return JSON.parse(cached) as T;
      } catch {}
    }
    return DEFAULT_SAMPLE_ROSTER as T;
  }

  if (action === 'saveMember') {
    const cached = localStorage.getItem('dd_roster_cache');
    const roster: Member[] = cached ? JSON.parse(cached) : [...DEFAULT_SAMPLE_ROSTER];
    const member = data as Member;
    if (member.rowIndex) {
      const idx = roster.findIndex((m) => String(m.rowIndex) === String(member.rowIndex));
      if (idx !== -1) roster[idx] = member;
      else roster.push(member);
    } else {
      member.rowIndex = 'LOCAL_' + Date.now();
      roster.push(member);
    }
    localStorage.setItem('dd_roster_cache', JSON.stringify(roster));
    return roster as T;
  }

  if (action === 'deleteMember') {
    const cached = localStorage.getItem('dd_roster_cache');
    let roster: Member[] = cached ? JSON.parse(cached) : [...DEFAULT_SAMPLE_ROSTER];
    roster = roster.filter((m) => String(m.rowIndex) !== String(data));
    localStorage.setItem('dd_roster_cache', JSON.stringify(roster));
    return 'Deleted' as T;
  }

  if (action === 'listSessions') {
    const direct = await fetchSessionsFromSheetDirect();
    if (direct && direct.list.length > 0) {
      return direct.list as unknown as T;
    }
    const table = getLocalSessionsSheetTable();
    const list: SavedSessionSummary[] = Object.values(table)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((s) => ({
        id: s.date,
        name: formatDisplayDate(s.date) || s.date,
        rawDate: s.date,
        version: s.version || 1,
        updatedAt: s.updatedAt || '',
        updatedBy: s.updatedBy || 'Sheet Cache',
        attendanceCount: (s.attendance || []).length,
        boatsCount: (s.boats || []).length,
      }));
    return list as T;
  }

  if (action === 'checkSessionExists') {
    const dateStr = String(data || '').replace('.json', '').trim();
    const table = getLocalSessionsSheetTable();
    if (table[dateStr]) return true as T;
    const direct = await fetchSessionsFromSheetDirect();
    return Boolean(direct?.table[dateStr]) as T;
  }

  if (action === 'saveSessionToDrive' || action === 'saveSessionToSheet') {
    const { dateStr, jsonContent, updatedBy } = data;
    const cleanDate = String(dateStr || '').replace('.json', '').trim();
    const table = getLocalSessionsSheetTable();
    const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    const nextVer = (table[cleanDate]?.version || 0) + 1;
    const record: SessionData = {
      ...parsed,
      date: cleanDate,
      version: nextVer,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || 'Collaborator',
    };
    table[cleanDate] = record;
    saveLocalSessionsSheetTable(table);
    return record as T;
  }

  if (action === 'applySessionDelta') {
    const dateStr = String(data.date || '').trim();
    const table = getLocalSessionsSheetTable();
    const current: SessionData = table[dateStr] || {
      date: dateStr,
      attendance: [],
      boats: [],
      version: 0,
    };
    const ops: SessionDeltaOp[] = Array.isArray(data.ops) ? data.ops : [data.op];
    const updated = applyLocalDelta(current, ops, data.updatedBy || 'Collaborator');
    table[dateStr] = updated;
    saveLocalSessionsSheetTable(table);
    return { session: updated, activeUsers: [] } as T;
  }

  if (action === 'loadSessionFile' || action === 'loadSession') {
    const cleanDate = String(data || '').replace('.json', '').trim();
    const direct = await fetchSessionsFromSheetDirect();
    if (direct && direct.table[cleanDate]) {
      return JSON.stringify(direct.table[cleanDate]) as T;
    }
    const table = getLocalSessionsSheetTable();
    if (table[cleanDate]) {
      return JSON.stringify(table[cleanDate]) as T;
    }
    const legacy = localStorage.getItem(`dd_session_${cleanDate}`);
    if (legacy) return legacy as T;
    throw error;
  }

  if (action === 'deleteSession') {
    const cleanDate = String(data || '').replace('.json', '').trim();
    const table = getLocalSessionsSheetTable();
    delete table[cleanDate];
    delete memorySessionsTable[cleanDate];
    saveLocalSessionsSheetTable(table);
    return { deleted: true, date: cleanDate } as T;
  }

  if (action === 'syncState') {
    return {
      activeUsers: [],
      activeSessionDate: data?.sessionDate || null,
      rosterVersion: '',
      roster: null,
      session: null,
    } as T;
  }

  if (action === 'saveBoatImageToDrive') {
    return { id: 'local_preview_' + Date.now() } as T;
  }

  throw error;
}

// ========================================================
// MULTI-USER COLLABORATIVE REAL-TIME TRANSPORT MANAGER
// ========================================================

export interface CollabCallbacks {
  onInit?: (payload: {
    roster?: Member[];
    activeSessionDate?: string | null;
    session?: SessionData | null;
    sessionsList?: SavedSessionSummary[];
    activeUsers?: CollaboratorPresence[];
  }) => void;
  onSessionUpdated: (session: SessionData, senderId?: string, opType?: string) => void;
  onSessionSwitched?: (date: string, session: SessionData | null, senderName?: string) => void;
  onRosterUpdated: (roster: Member[]) => void;
  onPresenceUpdated: (users: CollaboratorPresence[]) => void;
  onConnectionStateChange?: (connected: boolean) => void;
}

export class CollaborationManager {
  private ws: WebSocket | null = null;
  private bc: BroadcastChannel | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private callbacks: CollabCallbacks;
  private identity = getClientIdentity();
  private currentTab: ActiveTab = 'session';
  private currentSessionDate: string | null = null;
  private currentSessionVersion = 0;
  private currentRosterVersion = '';
  private selectedSeat: CollaboratorPresence['selectedSeat'] = null;
  private isDestroyed = false;
  private isPolling = false;

  constructor(callbacks: CollabCallbacks) {
    this.callbacks = callbacks;
    this.setupBroadcastChannel();
    this.connectWebSocket();
    this.startAdaptivePolling();
  }

  public getIdentity() {
    return this.identity;
  }

  public updateCollaboratorName(name: string) {
    this.identity.name = setCollaboratorName(name);
    this.sendPresence();
    return this.identity.name;
  }

  public setContext(params: {
    activeTab?: ActiveTab;
    sessionDate?: string | null;
    sessionVersion?: number;
    selectedSeat?: CollaboratorPresence['selectedSeat'];
  }) {
    let changed = false;
    if (params.activeTab !== undefined && params.activeTab !== this.currentTab) {
      this.currentTab = params.activeTab;
      changed = true;
    }
    if (params.sessionDate !== undefined && params.sessionDate !== this.currentSessionDate) {
      this.currentSessionDate = params.sessionDate;
      changed = true;
    }
    if (params.sessionVersion !== undefined) {
      this.currentSessionVersion = params.sessionVersion;
    }
    if (params.selectedSeat !== undefined) {
      this.selectedSeat = params.selectedSeat;
      changed = true;
    }
    if (changed) {
      this.sendPresence();
    }
  }

  private setupBroadcastChannel() {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this.bc = new BroadcastChannel('dd_planner_live_sync');
      this.bc.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg || msg.senderId === this.identity.clientId) return;
        if (msg.type === 'session:updated' && msg.session) {
          this.currentSessionVersion = Math.max(
            this.currentSessionVersion,
            Number(msg.session.version) || 0
          );
          this.callbacks.onSessionUpdated(msg.session, msg.senderId, msg.opType);
        } else if (msg.type === 'roster:updated' && Array.isArray(msg.roster)) {
          this.callbacks.onRosterUpdated(msg.roster);
        } else if (msg.type === 'session:switched' && msg.date) {
          this.callbacks.onSessionSwitched?.(msg.date, msg.session || null, msg.senderName);
        }
      };
    } catch {}
  }

  private connectWebSocket() {
    if (this.isDestroyed || typeof window === 'undefined') return;
    if (window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:') {
      this.callbacks.onConnectionStateChange?.(true);
      return;
    }

    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        this.callbacks.onConnectionStateChange?.(true);
        this.sendPresence();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'init') {
            if (msg.session?.version) {
              this.currentSessionVersion = Number(msg.session.version);
            }
            if (msg.rosterVersion) {
              this.currentRosterVersion = String(msg.rosterVersion);
            }
            this.callbacks.onInit?.(msg);
          } else if (msg.type === 'session:updated' && msg.session) {
            this.currentSessionVersion = Math.max(
              this.currentSessionVersion,
              Number(msg.session.version) || 0
            );
            this.callbacks.onSessionUpdated(msg.session, msg.senderId, msg.lastOpType);
          } else if (msg.type === 'session:switched' && msg.date) {
            if (msg.senderId !== this.identity.clientId) {
              this.callbacks.onSessionSwitched?.(msg.date, msg.session || null, msg.senderName);
            }
          } else if (msg.type === 'roster:updated' && Array.isArray(msg.roster)) {
            this.callbacks.onRosterUpdated(msg.roster);
          } else if (msg.type === 'presence:update' && Array.isArray(msg.activeUsers)) {
            this.callbacks.onPresenceUpdated(msg.activeUsers);
          }
        } catch {}
      };

      ws.onclose = () => {
        this.ws = null;
        if (!this.isDestroyed) {
          this.reconnectTimer = setTimeout(() => this.connectWebSocket(), 4000);
        }
      };
    } catch {
      // Fallback to polling
    }
  }

  public sendPresence() {
    const payload = {
      type: 'presence',
      clientId: this.identity.clientId,
      name: this.identity.name,
      color: this.identity.color,
      activeTab: this.currentTab,
      sessionDate: this.currentSessionDate,
      selectedSeat: this.selectedSeat,
    };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public broadcastSessionUpdate(session: SessionData, opType?: string) {
    this.currentSessionVersion = Math.max(this.currentSessionVersion, Number(session.version) || 0);
    if (this.bc) {
      try {
        this.bc.postMessage({
          type: 'session:updated',
          session,
          senderId: this.identity.clientId,
          opType,
        });
      } catch {}
    }
  }

  public broadcastSessionSwitch(date: string, session: SessionData | null) {
    this.currentSessionDate = date;
    if (session?.version) {
      this.currentSessionVersion = Number(session.version);
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'session:select',
          date,
          session,
          clientId: this.identity.clientId,
          updatedBy: this.identity.name,
        })
      );
    }
    if (this.bc) {
      try {
        this.bc.postMessage({
          type: 'session:switched',
          date,
          session,
          senderId: this.identity.clientId,
          senderName: this.identity.name,
        });
      } catch {}
    }
  }

  public broadcastRosterUpdate(roster: Member[]) {
    if (this.bc) {
      try {
        this.bc.postMessage({
          type: 'roster:updated',
          roster,
          senderId: this.identity.clientId,
        });
      } catch {}
    }
  }

  public async dispatchDelta(
    date: string,
    ops: SessionDeltaOp[],
    fullState?: SessionData
  ): Promise<SessionData | null> {
    if (!date || ops.length === 0) return null;

    markLocalSessionMutation(date);

    // Update local session cache immediately so any local read has the latest state
    try {
      const table = getLocalSessionsSheetTable();
      const base = fullState || table[date] || {
        date,
        attendance: [],
        boats: [],
        version: this.currentSessionVersion,
      };
      const optimistic = fullState
        ? {
            ...fullState,
            version: Math.max(this.currentSessionVersion, Number(fullState.version) || 0) + 1,
            updatedAt: new Date().toISOString(),
            updatedBy: this.identity.name,
          }
        : applyLocalDelta(base, ops, this.identity.name);
      table[date] = optimistic;
      saveLocalSessionsSheetTable(table);
    } catch {}

    const res = await apiCall<{ session: SessionData; activeUsers?: CollaboratorPresence[] }>(
      'applySessionDelta',
      {
        date,
        ops,
        fullState,
        clientId: this.identity.clientId,
        clientName: this.identity.name,
        clientColor: this.identity.color,
        activeTab: this.currentTab,
        sessionDate: date,
        updatedBy: this.identity.name,
      }
    );

    if (res?.session) {
      markLocalSessionMutation(date);
      this.currentSessionVersion = Math.max(
        this.currentSessionVersion,
        Number(res.session.version) || 0
      );
      this.broadcastSessionUpdate(res.session, ops[0]?.type);
      if (Array.isArray(res.activeUsers) && res.activeUsers.length > 0) {
        this.callbacks.onPresenceUpdated(res.activeUsers);
      }
      return res.session;
    }
    return null;
  }

  private startAdaptivePolling() {
    const isStaticHost =
      typeof window !== 'undefined' &&
      (window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:');
    const intervalMs = isStaticHost ? 12000 : 4000;

    const poll = async () => {
      if (this.isDestroyed || this.isPolling || activeForegroundCalls > 0) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (wasRecentlyMutatedLocally(this.currentSessionDate, 10000)) return;

      this.isPolling = true;
      try {
        const res = await apiCall<{
          activeUsers?: CollaboratorPresence[];
          activeSessionDate?: string | null;
          rosterVersion?: string;
          roster?: Member[] | null;
          session?: SessionData | null;
        }>('syncState', {
          clientId: this.identity.clientId,
          clientName: this.identity.name,
          clientColor: this.identity.color,
          activeTab: this.currentTab,
          sessionDate: this.currentSessionDate,
          selectedSeat: this.selectedSeat,
          knownSessionVersion: this.currentSessionVersion,
          knownRosterVersion: this.currentRosterVersion,
        });

        if (res) {
          this.callbacks.onConnectionStateChange?.(true);
          if (Array.isArray(res.activeUsers)) {
            this.callbacks.onPresenceUpdated(res.activeUsers);
          }
          if (res.rosterVersion && res.rosterVersion !== this.currentRosterVersion && Array.isArray(res.roster)) {
            this.currentRosterVersion = res.rosterVersion;
            this.callbacks.onRosterUpdated(res.roster);
          }
          if (
            res.session &&
            !wasRecentlyMutatedLocally(this.currentSessionDate, 10000) &&
            Number(res.session.version) > this.currentSessionVersion
          ) {
            this.currentSessionVersion = Number(res.session.version);
            this.callbacks.onSessionUpdated(res.session, 'remote_sync');
          }
        }
      } catch {
        this.callbacks.onConnectionStateChange?.(false);
      } finally {
        this.isPolling = false;
      }
    };

    this.pollTimer = setInterval(poll, intervalMs);
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', poll);
    }
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) this.ws.close();
    if (this.bc) this.bc.close();
  }
}
