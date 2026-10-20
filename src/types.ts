export interface Member {
  rowIndex?: number | string | null;
  name: string;
  type: 'Paddler' | 'Volunteer';
  side: 'Left' | 'Right' | 'Any';
  gender: 'M' | 'F';
  weight: number;
  active?: boolean;
  volunteers?: string; // Comma-separated names of linked members
}

export interface BoatSeat {
  role?: 'drummer' | 'helm';
  row?: number;
  side?: 'Left' | 'Right';
  occupant: string | null; // Name of member in this seat
}

export interface Boat {
  id: string;
  type: 'standard' | 'small';
  seats: BoatSeat[];
}

export interface SessionData {
  date: string;
  attendance: string[];
  boats: {
    id?: string;
    type: 'standard' | 'small';
    seats: BoatSeat[];
  }[];
  version?: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SavedSessionSummary {
  id: string;
  name: string;
  rawDate?: string;
  version?: number;
  updatedAt?: string;
  updatedBy?: string;
  attendanceCount?: number;
  boatsSummary?: string;
  boatsCount?: number;
}

export interface CollaboratorPresence {
  clientId: string;
  name: string;
  color: string;
  activeTab: ActiveTab;
  sessionDate: string | null;
  selectedSeat?: {
    boatId: string;
    role?: string;
    row?: number;
    side?: string;
  } | null;
  lastSeen: number;
}

export type SessionDeltaOp =
  | { type: 'TOGGLE_ATTENDANCE'; memberName: string; isChecked: boolean }
  | { type: 'TOGGLE_GROUP'; memberNames: string[]; isChecked: boolean }
  | { type: 'ADD_BOAT'; boat: Boat }
  | { type: 'REMOVE_BOAT'; boatId: string; boatIndex?: number }
  | {
      type: 'ASSIGN_SEAT';
      memberName: string;
      targetBoatId: string;
      targetBoatIndex?: number;
      targetRole?: 'drummer' | 'helm';
      targetRow?: number;
      targetSide?: 'Left' | 'Right';
      swapWithOccupant?: boolean;
    }
  | { type: 'RETURN_TO_POOL'; memberName: string }
  | { type: 'SET_BOATS'; boats: Boat[] }
  | { type: 'SET_FULL_STATE'; state: SessionData };

export type ActiveTab = 'roster' | 'session' | 'planning';
export type SessionSubTab = 'new' | 'load';
export type SaveStatus = 'idle' | 'waiting' | 'saving' | 'saved' | 'error';
export type BalanceMode = 'stability' | 'rocket';
