import { Member, SessionData } from '../types';

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

const DEFAULT_SAMPLE_ROSTER: Member[] = [
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

export async function apiCall<T = any>(action: string, data: any = {}): Promise<T> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

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
      return result.data as T;
    } else {
      throw new Error(result.message || 'API returned failure status');
    }
  } catch (error: any) {
    console.warn(`API error on ${action}:`, error);

    // Fallback handlers for offline / CORS / API failure
    if (action === 'getRosterData') {
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
      let roster: Member[] = cached ? JSON.parse(cached) : [...DEFAULT_SAMPLE_ROSTER];
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
      return member as T;
    }

    if (action === 'deleteMember') {
      const cached = localStorage.getItem('dd_roster_cache');
      let roster: Member[] = cached ? JSON.parse(cached) : [...DEFAULT_SAMPLE_ROSTER];
      roster = roster.filter((m) => String(m.rowIndex) !== String(data));
      localStorage.setItem('dd_roster_cache', JSON.stringify(roster));
      return true as T;
    }

    if (action === 'listSessions') {
      const localSessions = JSON.parse(localStorage.getItem('dd_sessions_list') || '[]');
      return localSessions as T;
    }

    if (action === 'checkSessionExists') {
      const localSessions: { id: string; name: string }[] = JSON.parse(
        localStorage.getItem('dd_sessions_list') || '[]'
      );
      return localSessions.some((s) => s.id === data || s.name.includes(data)) as T;
    }

    if (action === 'saveSessionToDrive') {
      const { dateStr, jsonContent } = data;
      localStorage.setItem(`dd_session_${dateStr}`, jsonContent);
      const localSessions: { id: string; name: string }[] = JSON.parse(
        localStorage.getItem('dd_sessions_list') || '[]'
      );
      if (!localSessions.some((s) => s.id === dateStr)) {
        localSessions.unshift({ id: dateStr, name: `Session ${dateStr}` });
        localStorage.setItem('dd_sessions_list', JSON.stringify(localSessions));
      }
      return { success: true } as T;
    }

    if (action === 'loadSessionFile') {
      const saved = localStorage.getItem(`dd_session_${data}`);
      if (saved) return saved as T;
      throw error;
    }

    if (action === 'saveBoatImageToDrive') {
      return { id: 'local_preview_' + Date.now() } as T;
    }

    throw error;
  }
}
