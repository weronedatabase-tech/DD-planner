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
  attendance: (number | string)[]; // Member indexes or identifiers
  boats: {
    type: 'standard' | 'small';
    seats: BoatSeat[];
  }[];
}

export type ActiveTab = 'roster' | 'session' | 'planning';
export type SessionSubTab = 'new' | 'load';
export type SaveStatus = 'idle' | 'waiting' | 'saving' | 'saved' | 'error';
export type BalanceMode = 'stability' | 'rocket';
