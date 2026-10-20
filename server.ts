import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';

const PORT = 3000;
const GAS_API_URL =
  'https://script.google.com/macros/s/AKfycbw2IQxPX-Mn3Zy-8-YNHOrfOjsDGGWIBb0-xLp9g3DM1zcv4-DgsjhRG9RR0bc20Q1U/exec';

interface CollaboratorPresence {
  clientId: string;
  name: string;
  color: string;
  activeTab: string;
  sessionDate: string | null;
  selectedSeat: {
    boatId: string;
    role?: string;
    row?: number;
    side?: string;
  } | null;
  lastSeen: number;
}

interface SeatData {
  role?: 'drummer' | 'helm';
  row?: number;
  side?: 'Left' | 'Right';
  occupant: string | null;
}

interface BoatData {
  id: string;
  type: 'standard' | 'small';
  seats: SeatData[];
}

interface SessionRecord {
  date: string;
  attendance: string[];
  boats: BoatData[];
  version: number;
  updatedAt: string;
  updatedBy: string;
}

interface MemberRecord {
  rowIndex?: number | string | null;
  name: string;
  type: 'Paddler' | 'Volunteer';
  side: 'Left' | 'Right' | 'Any';
  gender: 'M' | 'F';
  weight: number;
  active?: boolean;
  volunteers?: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'collab_state.json');

const DEFAULT_ROSTER: MemberRecord[] = [
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

interface ServerState {
  roster: MemberRecord[];
  rosterVersion: number;
  sessions: Record<string, SessionRecord>;
  activeSessionDate: string | null;
}

function loadPersistedState(): ServerState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        roster: Array.isArray(parsed.roster) && parsed.roster.length > 0 ? parsed.roster : [...DEFAULT_ROSTER],
        rosterVersion: Number(parsed.rosterVersion) || 1,
        sessions: parsed.sessions || {},
        activeSessionDate: parsed.activeSessionDate || null,
      };
    }
  } catch (e) {
    console.warn('Failed to load persisted state:', e);
  }
  const today = new Date().toISOString().split('T')[0];
  return {
    roster: [...DEFAULT_ROSTER],
    rosterVersion: 1,
    sessions: {
      [today]: {
        date: today,
        attendance: DEFAULT_ROSTER.slice(0, 14).map((m) => m.name),
        boats: [
          {
            id: 'boat-initial-1',
            type: 'small',
            seats: [
              { role: 'drummer', occupant: null },
              { row: 1, side: 'Left', occupant: 'Alex Wong' },
              { row: 1, side: 'Right', occupant: 'Sam Chen' },
              { row: 2, side: 'Left', occupant: 'Sarah Jenkins' },
              { row: 2, side: 'Right', occupant: 'Marcus Taylor' },
              { row: 3, side: 'Left', occupant: 'David Kim' },
              { row: 3, side: 'Right', occupant: 'Emily Watson' },
              { row: 4, side: 'Left', occupant: 'Jessica Alba' },
              { row: 4, side: 'Right', occupant: 'Jason Lee' },
              { row: 5, side: 'Left', occupant: 'Michael Tan' },
              { row: 5, side: 'Right', occupant: 'Chris Evans' },
              { role: 'helm', occupant: null },
            ],
          },
        ],
        version: 1,
        updatedAt: new Date().toISOString(),
        updatedBy: 'System',
      },
    },
    activeSessionDate: today,
  };
}

const state: ServerState = loadPersistedState();
const presenceMap = new Map<string, CollaboratorPresence>();
const socketClientMap = new Map<WebSocket, string>();

function persistState() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Persist error:', e);
  }
}

// Forward call to Google Apps Script in background or directly
async function callGoogleAppsScript(action: string, data: any): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(GAS_API_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, data }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const json = await res.json();
    if (json && json.status === 'success') {
      return json.data;
    }
  } catch {
    // Offline or GAS unreachable
  }
  return null;
}

const PROD_SHEET_ID = '1JKHOx-53BbL3XfP1RqYQ7QLmb2vg1q_rlvnXda5ervw';

async function syncSessionsFromSheetDirect(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const url = `https://docs.google.com/spreadsheets/d/${PROD_SHEET_ID}/gviz/tq?tqx=out:json&sheet=Sessions&_=${Date.now()}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const txt = await res.text();
    const start = txt.indexOf('{');
    const end = txt.lastIndexOf('}');
    if (start === -1 || end === -1) return false;
    const parsed = JSON.parse(txt.substring(start, end + 1));
    const rows = parsed?.table?.rows || [];
    let updated = false;

    for (const r of rows) {
      const c = r?.c || [];
      const rawDate = c[0]?.v ? String(c[0].v).trim().replace(/^'/, '') : '';
      if (!rawDate || rawDate.toLowerCase() === 'session date') continue;
      const updatedAt = c[2]?.v ? String(c[2].v) : '';
      const version = Number(c[3]?.v) || 1;
      const updatedBy = c[4]?.v ? String(c[4].v) : 'Google Sheet';
      const jsonCell = c[8]?.v ? String(c[8].v) : '';

      if (jsonCell) {
        try {
          const sessObj = JSON.parse(jsonCell);
          const dKey = sessObj.date || rawDate;
          const existing = state.sessions[dKey];
          const isPlaceholder =
            existing && existing.attendance.length === 0 && existing.boats.length === 0;
          if (!existing || isPlaceholder || (Number(sessObj.version) || 1) >= existing.version) {
            state.sessions[dKey] = {
              date: dKey,
              attendance: Array.isArray(sessObj.attendance) ? sessObj.attendance.map(String) : [],
              boats: Array.isArray(sessObj.boats) ? sessObj.boats : [],
              version: Number(sessObj.version) || version,
              updatedAt: sessObj.updatedAt || updatedAt,
              updatedBy: sessObj.updatedBy || updatedBy,
            };
            updated = true;
          }
        } catch {}
      }
    }

    if (updated) {
      persistState();
    }
    return updated;
  } catch {
    return false;
  }
}

function getActiveCollaborators(): CollaboratorPresence[] {
  const now = Date.now();
  const list: CollaboratorPresence[] = [];
  for (const [id, p] of presenceMap.entries()) {
    if (now - p.lastSeen > 30000) {
      presenceMap.delete(id);
    } else {
      list.push(p);
    }
  }
  return list;
}

function applyDeltaToSession(session: SessionRecord, ops: any[], author: string): SessionRecord {
  let attendance = [...session.attendance];
  let boats: BoatData[] = session.boats.map((b) => ({
    ...b,
    seats: b.seats.map((s) => ({ ...s })),
  }));

  for (const op of ops) {
    if (!op || !op.type) continue;

    if (op.type === 'TOGGLE_ATTENDANCE') {
      const name = String(op.memberName);
      if (op.isChecked) {
        if (!attendance.includes(name)) attendance.push(name);
      } else {
        attendance = attendance.filter((n) => n !== name);
        boats = boats.map((b) => ({
          ...b,
          seats: b.seats.map((s) => (s.occupant === name ? { ...s, occupant: null } : s)),
        }));
      }
    } else if (op.type === 'TOGGLE_GROUP') {
      const names: string[] = Array.isArray(op.memberNames) ? op.memberNames.map(String) : [];
      if (op.isChecked) {
        names.forEach((n) => {
          if (!attendance.includes(n)) attendance.push(n);
        });
      } else {
        attendance = attendance.filter((n) => !names.includes(n));
        boats = boats.map((b) => ({
          ...b,
          seats: b.seats.map((s) =>
            s.occupant && names.includes(s.occupant) ? { ...s, occupant: null } : s
          ),
        }));
      }
    } else if (op.type === 'ADD_BOAT') {
      const newBoat = op.boat as BoatData;
      if (newBoat && !boats.some((b) => b.id === newBoat.id)) {
        boats.push(newBoat);
      }
    } else if (op.type === 'REMOVE_BOAT') {
      boats = boats.filter((b, idx) => (op.boatId && b.id ? b.id !== op.boatId : idx !== op.boatIndex));
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

      boats.forEach((b, bIdx) => {
        const isTarget = (targetBoatId && b.id === targetBoatId) || bIdx === targetBoatIndex;
        if (!isTarget) return;
        b.seats.forEach((s) => {
          const match = targetRole
            ? s.role === targetRole
            : Number(s.row) === Number(targetRow) && s.side === targetSide;
          if (match) {
            const displaced = s.occupant;
            s.occupant = memberName;
            if (displaced && swapWithOccupant && prevBoatIdx !== -1 && prevSeatIdx !== -1) {
              boats[prevBoatIdx].seats[prevSeatIdx].occupant = displaced;
            }
          }
        });
      });
    } else if (op.type === 'RETURN_TO_POOL') {
      const targetName = op.memberName;
      boats.forEach((b) => {
        b.seats.forEach((s) => {
          if (s.occupant === targetName) s.occupant = null;
        });
      });
    } else if (op.type === 'SET_BOATS') {
      if (Array.isArray(op.boats)) {
        boats = op.boats;
      }
    } else if (op.type === 'SET_FULL_STATE') {
      if (op.state) {
        if (Array.isArray(op.state.attendance)) attendance = op.state.attendance.map(String);
        if (Array.isArray(op.state.boats)) boats = op.state.boats;
      }
    }
  }

  return {
    date: session.date,
    attendance,
    boats,
    version: (session.version || 0) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: author || 'Collaborator',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use(express.text({ limit: '15mb' }));

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  function broadcast(message: any, excludeWs?: WebSocket) {
    const payload = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  // Initial background sync from Google Sheet on server startup
  (async () => {
    await syncSessionsFromSheetDirect();
    const remoteRoster = await callGoogleAppsScript('getRosterData', {});
    if (Array.isArray(remoteRoster) && remoteRoster.length > 0) {
      state.roster = remoteRoster;
      state.rosterVersion++;
      persistState();
    }
  })();

  wss.on('connection', (ws) => {
    // Send initial snapshot immediately upon connection
    ws.send(
      JSON.stringify({
        type: 'init',
        roster: state.roster,
        rosterVersion: state.rosterVersion,
        activeSessionDate: state.activeSessionDate,
        session: state.activeSessionDate ? state.sessions[state.activeSessionDate] || null : null,
        sessionsList: Object.values(state.sessions)
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((s) => ({
            id: s.date,
            name: s.date,
            rawDate: s.date,
            version: s.version,
            updatedAt: s.updatedAt,
            updatedBy: s.updatedBy,
            attendanceCount: s.attendance.length,
          })),
        activeUsers: getActiveCollaborators(),
      })
    );

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'presence') {
          const clientId = String(msg.clientId || '');
          if (!clientId) return;
          socketClientMap.set(ws, clientId);
          presenceMap.set(clientId, {
            clientId,
            name: msg.name || 'Coach',
            color: msg.color || '#3b82f6',
            activeTab: msg.activeTab || 'planning',
            sessionDate: msg.sessionDate || state.activeSessionDate,
            selectedSeat: msg.selectedSeat || null,
            lastSeen: Date.now(),
          });
          broadcast({
            type: 'presence:update',
            activeUsers: getActiveCollaborators(),
          });
        } else if (msg.type === 'session:delta') {
          const dateStr = String(msg.date || state.activeSessionDate || '');
          if (!dateStr) return;
          const existing: SessionRecord = state.sessions[dateStr] || {
            date: dateStr,
            attendance: [],
            boats: [],
            version: 0,
            updatedAt: new Date().toISOString(),
            updatedBy: msg.updatedBy || 'Collaborator',
          };
          const ops = Array.isArray(msg.ops) ? msg.ops : [msg.op];
          const updated = applyDeltaToSession(existing, ops, msg.updatedBy || 'Collaborator');
          state.sessions[dateStr] = updated;
          state.activeSessionDate = dateStr;
          persistState();

          // Broadcast to all connected clients (including sender for version confirmation)
          broadcast({
            type: 'session:updated',
            session: updated,
            senderId: msg.clientId,
            lastOpType: ops[0]?.type || 'UPDATE',
          });

          // Sync to Google Sheet in background
          callGoogleAppsScript('applySessionDelta', {
            date: dateStr,
            ops,
            updatedBy: msg.updatedBy,
            clientId: msg.clientId,
            clientName: msg.updatedBy,
          }).catch(() => {});
        } else if (msg.type === 'session:select') {
          const dateStr = String(msg.date || '');
          if (!dateStr) return;
          state.activeSessionDate = dateStr;
          if (!state.sessions[dateStr] && msg.session) {
            state.sessions[dateStr] = msg.session;
          }
          persistState();
          broadcast({
            type: 'session:switched',
            date: dateStr,
            session: state.sessions[dateStr] || null,
            senderId: msg.clientId,
            senderName: msg.updatedBy,
          });
        }
      } catch (err) {
        console.warn('WS message error:', err);
      }
    });

    ws.on('close', () => {
      const clientId = socketClientMap.get(ws);
      if (clientId) {
        presenceMap.delete(clientId);
        socketClientMap.delete(ws);
        broadcast({
          type: 'presence:update',
          activeUsers: getActiveCollaborators(),
        });
      }
    });
  });

  // Unified API endpoint for collaborative state & Google Sheets proxy
  app.post('/api/action', async (req, res) => {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action, data } = body;

      if (action === 'getRosterData') {
        const remote = await callGoogleAppsScript('getRosterData', {});
        if (Array.isArray(remote) && remote.length > 0) {
          state.roster = remote;
          persistState();
        }
        return res.json({ status: 'success', data: state.roster });
      }

      if (action === 'saveMember') {
        const member = data as MemberRecord;
        const isNew = !member.rowIndex || String(member.rowIndex).startsWith('TEMP_') || String(member.rowIndex).startsWith('LOCAL_');
        if (!isNew) {
          const idx = state.roster.findIndex((m) => String(m.rowIndex) === String(member.rowIndex));
          if (idx !== -1) state.roster[idx] = member;
          else state.roster.push(member);
        } else {
          const existingIdx = state.roster.findIndex(
            (m) => m.name.toLowerCase() === member.name.toLowerCase()
          );
          if (existingIdx !== -1) {
            state.roster[existingIdx] = { ...member, rowIndex: state.roster[existingIdx].rowIndex };
          } else {
            const maxRow = state.roster.reduce((acc, m) => Math.max(acc, Number(m.rowIndex) || 2), 2);
            member.rowIndex = maxRow + 1;
            state.roster.push(member);
          }
        }

        // Reciprocal volunteer/paddler links
        const linkedNames = member.volunteers
          ? member.volunteers.split(',').map((s) => s.trim()).filter(Boolean)
          : [];
        const myName = member.name;
        state.roster = state.roster.map((r) => {
          if (r.name === myName) return r;
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
          return modified ? { ...r, volunteers: otherLinks.join(',') } : r;
        });

        state.rosterVersion++;
        persistState();

        broadcast({
          type: 'roster:updated',
          roster: state.roster,
          rosterVersion: state.rosterVersion,
        });

        callGoogleAppsScript('saveMember', member).catch(() => {});
        return res.json({ status: 'success', data: state.roster });
      }

      if (action === 'deleteMember') {
        const targetRowIndex = data;
        const removed = state.roster.find((m) => String(m.rowIndex) === String(targetRowIndex));
        state.roster = state.roster.filter((m) => String(m.rowIndex) !== String(targetRowIndex));
        if (removed) {
          // Also clean up from sessions
          Object.values(state.sessions).forEach((sess) => {
            sess.attendance = sess.attendance.filter((n) => n !== removed.name);
            sess.boats.forEach((b) => {
              b.seats.forEach((s) => {
                if (s.occupant === removed.name) s.occupant = null;
              });
            });
          });
        }
        state.rosterVersion++;
        persistState();

        broadcast({
          type: 'roster:updated',
          roster: state.roster,
          rosterVersion: state.rosterVersion,
        });

        callGoogleAppsScript('deleteMember', targetRowIndex).catch(() => {});
        return res.json({ status: 'success', data: 'Deleted' });
      }

      if (action === 'listSessions') {
        await syncSessionsFromSheetDirect();
        const list = Object.values(state.sessions)
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((s) => ({
            id: s.date,
            name: s.date,
            rawDate: s.date,
            version: s.version,
            updatedAt: s.updatedAt,
            updatedBy: s.updatedBy,
            attendanceCount: s.attendance.length,
            boatsCount: s.boats.length,
            sessionJson: JSON.stringify(s),
          }));
        return res.json({ status: 'success', data: list });
      }

      if (action === 'checkSessionExists') {
        const dateStr = String(data || '').replace('.json', '').trim();
        const existsLocal = !!state.sessions[dateStr];
        if (existsLocal) return res.json({ status: 'success', data: true });
        const existsRemote = await callGoogleAppsScript('checkSessionExists', dateStr);
        return res.json({ status: 'success', data: !!existsRemote });
      }

      if (action === 'loadSessionFile' || action === 'loadSession') {
        const dateStr = String(data || '').replace('.json', '').trim();
        if (
          state.sessions[dateStr] &&
          (state.sessions[dateStr].attendance.length > 0 || state.sessions[dateStr].boats.length > 0)
        ) {
          state.activeSessionDate = dateStr;
          persistState();
          return res.json({ status: 'success', data: JSON.stringify(state.sessions[dateStr]) });
        }
        await syncSessionsFromSheetDirect();
        if (
          state.sessions[dateStr] &&
          (state.sessions[dateStr].attendance.length > 0 || state.sessions[dateStr].boats.length > 0)
        ) {
          state.activeSessionDate = dateStr;
          persistState();
          return res.json({ status: 'success', data: JSON.stringify(state.sessions[dateStr]) });
        }
        const remote = await callGoogleAppsScript('loadSessionFile', dateStr);
        if (remote) {
          try {
            const parsed = typeof remote === 'string' ? JSON.parse(remote) : remote;
            const dKey = parsed.date || dateStr;
            state.sessions[dKey] = {
              date: dKey,
              attendance: Array.isArray(parsed.attendance) ? parsed.attendance.map(String) : [],
              boats: Array.isArray(parsed.boats) ? parsed.boats : [],
              version: Number(parsed.version) || 1,
              updatedAt: parsed.updatedAt || new Date().toISOString(),
              updatedBy: parsed.updatedBy || 'Google Sheet',
            };
            state.activeSessionDate = dKey;
            persistState();
            return res.json({ status: 'success', data: JSON.stringify(state.sessions[dKey]) });
          } catch {}
        }
        if (state.sessions[dateStr]) {
          state.activeSessionDate = dateStr;
          return res.json({ status: 'success', data: JSON.stringify(state.sessions[dateStr]) });
        }
        return res.status(404).json({ status: 'error', message: 'Session not found' });
      }

      if (action === 'saveSessionToDrive' || action === 'saveSessionToSheet') {
        const { dateStr, jsonContent, updatedBy } = data;
        const cleanDate = String(dateStr || '').replace('.json', '').trim();
        const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
        const prevVer = state.sessions[cleanDate]?.version || 0;
        const nextRecord: SessionRecord = {
          date: cleanDate,
          attendance: Array.isArray(parsed.attendance) ? parsed.attendance.map(String) : [],
          boats: Array.isArray(parsed.boats) ? parsed.boats : [],
          version: Math.max(prevVer + 1, (Number(parsed.version) || 0) + 1),
          updatedAt: new Date().toISOString(),
          updatedBy: updatedBy || parsed.updatedBy || 'Collaborator',
        };
        state.sessions[cleanDate] = nextRecord;
        state.activeSessionDate = cleanDate;
        persistState();

        broadcast({
          type: 'session:updated',
          session: nextRecord,
        });

        callGoogleAppsScript('saveSessionToSheet', {
          dateStr: cleanDate,
          jsonContent: JSON.stringify(nextRecord),
          updatedBy: nextRecord.updatedBy,
        }).catch(() => {});

        return res.json({ status: 'success', data: nextRecord });
      }

      if (action === 'applySessionDelta') {
        const dateStr = String(data.date || state.activeSessionDate || '').trim();
        const existing: SessionRecord = state.sessions[dateStr] || {
          date: dateStr,
          attendance: [],
          boats: [],
          version: 0,
          updatedAt: new Date().toISOString(),
          updatedBy: data.updatedBy || 'Collaborator',
        };
        const ops = Array.isArray(data.ops) ? data.ops : [data.op];
        const updated = applyDeltaToSession(existing, ops, data.updatedBy || data.clientName || 'Collaborator');
        state.sessions[dateStr] = updated;
        state.activeSessionDate = dateStr;
        persistState();

        broadcast({
          type: 'session:updated',
          session: updated,
          senderId: data.clientId,
          lastOpType: ops[0]?.type || 'UPDATE',
        });

        callGoogleAppsScript('applySessionDelta', data).catch(() => {});

        return res.json({
          status: 'success',
          data: {
            session: updated,
            activeUsers: getActiveCollaborators(),
          },
        });
      }

      if (action === 'deleteSession') {
        const cleanDate = String(data || '').replace('.json', '').trim();
        delete state.sessions[cleanDate];
        if (state.activeSessionDate === cleanDate) {
          const remaining = Object.keys(state.sessions).sort((a, b) => b.localeCompare(a));
          state.activeSessionDate = remaining[0] || null;
        }
        persistState();
        broadcast({
          type: 'session:deleted',
          date: cleanDate,
          activeSessionDate: state.activeSessionDate,
        });
        callGoogleAppsScript('deleteSession', cleanDate).catch(() => {});
        return res.json({ status: 'success', data: { deleted: true, date: cleanDate } });
      }

      if (action === 'syncState') {
        if (data && data.clientId) {
          presenceMap.set(data.clientId, {
            clientId: data.clientId,
            name: data.clientName || 'Coach',
            color: data.clientColor || '#3b82f6',
            activeTab: data.activeTab || 'planning',
            sessionDate: data.sessionDate || state.activeSessionDate,
            selectedSeat: data.selectedSeat || null,
            lastSeen: Date.now(),
          });
        }
        const targetDate = data?.sessionDate || state.activeSessionDate;
        const currentSession = targetDate ? state.sessions[targetDate] || null : null;
        const knownVer = Number(data?.knownSessionVersion) || 0;
        const knownRosterVer = Number(data?.knownRosterVersion) || 0;

        return res.json({
          status: 'success',
          data: {
            activeUsers: getActiveCollaborators(),
            activeSessionDate: state.activeSessionDate,
            rosterVersion: String(state.rosterVersion),
            roster: state.rosterVersion !== knownRosterVer ? state.roster : null,
            session: currentSession && (currentSession.version > knownVer || data?.forceSessionFetch) ? currentSession : null,
          },
        });
      }

      if (action === 'saveBoatImageToDrive') {
        const remote = await callGoogleAppsScript('saveBoatImageToDrive', data);
        if (remote && remote.id) {
          return res.json({ status: 'success', data: remote });
        }
        return res.json({ status: 'success', data: { id: 'local_preview_' + Date.now() } });
      }

      return res.status(400).json({ status: 'error', message: `Unknown action: ${action}` });
    } catch (err: any) {
      return res.status(500).json({ status: 'error', message: err.message || 'Server error' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Different Dragons Collaborative Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
