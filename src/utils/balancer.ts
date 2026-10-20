import { Boat, Member, BalanceMode } from '../types';

interface Person {
  name: string;
  wt: number;
  side: 'Left' | 'Right' | 'Any';
  type: 'Paddler' | 'Volunteer';
  links: string;
}

interface Pair {
  p1: Person;
  p2: Person | null;
  combinedWt: number;
}

export function calculateBoatWeight(boat: Boat, memberMap: Map<string, Member>): { left: number; right: number } {
  let left = 0;
  let right = 0;
  boat.seats.forEach((seat) => {
    if (!seat.occupant) return;
    const member = memberMap.get(seat.occupant);
    const weight = member?.weight || 0;
    if (seat.side === 'Left') left += weight;
    else if (seat.side === 'Right') right += weight;
  });
  return { left, right };
}

export function runAutoBalanceBoats(
  boats: Boat[],
  attendingMembers: Member[],
  mode: BalanceMode,
  memberMap: Map<string, Member>
): Boat[] {
  if (boats.length === 0) return boats;

  // Clone boats deeply
  const newBoats: Boat[] = boats.map((b) => ({
    ...b,
    seats: b.seats.map((s) => ({ ...s })),
  }));

  // Protected names: occupant in drummer or helm seats
  const protectedNames = new Set<string>();
  newBoats.forEach((boat) => {
    boat.seats.forEach((seat) => {
      if ((seat.role === 'drummer' || seat.role === 'helm') && seat.occupant) {
        protectedNames.add(seat.occupant);
      }
    });
  });

  // Clear all row seats (keep drummer & helm seats untouched)
  newBoats.forEach((boat) => {
    boat.seats.forEach((seat) => {
      if (seat.row !== undefined) {
        seat.occupant = null;
      }
    });
  });

  // Prepare eligible attendees
  const allPeople: Person[] = attendingMembers
    .filter((m) => !protectedNames.has(m.name))
    .map((m) => ({
      name: m.name,
      wt: Number(m.weight) || 0,
      side: m.side || 'Any',
      type: m.type,
      links: m.volunteers || '',
    }));

  let paddlers = allPeople.filter((p) => p.type === 'Paddler');
  let volunteers = allPeople.filter((p) => p.type === 'Volunteer');
  const pairs: Pair[] = [];

  // Step 1: Pair Paddlers with linked Volunteers
  paddlers = paddlers.filter((p) => {
    if (!p.links) return true;
    const linkedNames = p.links.split(',').map((s) => s.trim());
    const volIndex = volunteers.findIndex((v) => linkedNames.includes(v.name));
    if (volIndex !== -1) {
      const v = volunteers.splice(volIndex, 1)[0];
      pairs.push({ p1: p, p2: v, combinedWt: p.wt + v.wt });
      return false;
    }
    return true;
  });

  // Helper: side compatibility
  const isComp = (s1: string, s2: string) => s1 === 'Any' || s2 === 'Any' || s1 !== s2;

  // Step 2: Pair remaining paddlers with compatible volunteers
  paddlers.sort((a, b) => b.wt - a.wt);
  paddlers = paddlers.filter((p) => {
    if (volunteers.length === 0) return true;
    volunteers.sort((a, b) => b.wt - a.wt);
    const volIndex = volunteers.findIndex((v) => isComp(p.side, v.side));
    if (volIndex !== -1) {
      const v = volunteers.splice(volIndex, 1)[0];
      pairs.push({ p1: p, p2: v, combinedWt: p.wt + v.wt });
      return false;
    }
    return true;
  });

  // If unpaired paddlers remain, add as single
  paddlers.forEach((p) => {
    pairs.push({ p1: p, p2: null, combinedWt: p.wt });
  });

  // Step 3: Pair remaining volunteers
  while (volunteers.length >= 2) {
    const v1 = volunteers.shift()!;
    const v2Index = volunteers.findIndex((v) => isComp(v1.side, v.side));
    if (v2Index !== -1) {
      const v2 = volunteers.splice(v2Index, 1)[0];
      pairs.push({ p1: v1, p2: v2, combinedWt: v1.wt + v2.wt });
    } else {
      pairs.push({ p1: v1, p2: null, combinedWt: v1.wt });
    }
  }
  if (volunteers.length === 1) {
    pairs.push({ p1: volunteers[0], p2: null, combinedWt: volunteers[0].wt });
  }

  // Sort pairs by combined weight descending
  pairs.sort((a, b) => b.combinedWt - a.combinedWt);

  // Step 4: Generate slots across boats
  interface Slot {
    boatId: string;
    boatIdx: number;
    row: number;
    priority: number;
  }

  const allSlots: Slot[] = [];
  newBoats.forEach((b, boatIdx) => {
    const rowCount = b.type === 'standard' ? 10 : 5;
    const rowOrder: number[] = [];

    if (mode === 'rocket') {
      const mid = (rowCount + 1) / 2;
      for (let i = 1; i <= rowCount; i++) rowOrder.push(i);
      rowOrder.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
    } else {
      for (let i = 1; i <= rowCount; i++) rowOrder.push(i);
    }

    rowOrder.forEach((r, priorityIdx) => {
      allSlots.push({
        boatId: b.id,
        boatIdx,
        row: r,
        priority: priorityIdx,
      });
    });
  });

  allSlots.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.boatIdx - b.boatIdx;
  });

  // Step 5: Fill slots
  allSlots.forEach((slot) => {
    if (pairs.length === 0) return;

    const boat = newBoats.find((b) => b.id === slot.boatId);
    if (!boat) return;

    const seatL = boat.seats.find((s) => s.row === slot.row && s.side === 'Left');
    const seatR = boat.seats.find((s) => s.row === slot.row && s.side === 'Right');
    if (!seatL || !seatR) return;

    // Odd rows prefer Paddler on Left; even rows prefer Paddler on Right
    const targetPaddlerSide = slot.row % 2 !== 0 ? 'Left' : 'Right';

    let pairIndex = pairs.findIndex((p) => {
      const paddler = p.p1.type === 'Paddler' ? p.p1 : p.p2 && p.p2.type === 'Paddler' ? p.p2 : null;
      if (!paddler) return false;
      return paddler.side === 'Any' || paddler.side === targetPaddlerSide;
    });

    if (pairIndex === -1) pairIndex = 0;

    const pair = pairs.splice(pairIndex, 1)[0];
    const { p1, p2 } = pair;

    const getBoatWeightsNow = () => calculateBoatWeight(boat, memberMap);

    if (!p2) {
      const weights = getBoatWeightsNow();
      if (weights.left <= weights.right) {
        seatL.occupant = p1.name;
      } else {
        seatR.occupant = p1.name;
      }
    } else {
      const isPV =
        (p1.type === 'Paddler' && p2.type === 'Volunteer') ||
        (p1.type === 'Volunteer' && p2.type === 'Paddler');

      let placementDecided = false;
      if (isPV) {
        const paddler = p1.type === 'Paddler' ? p1 : p2;
        const volunteer = p1.type === 'Paddler' ? p2 : p1;

        const pFits = paddler.side === 'Any' || paddler.side === targetPaddlerSide;
        const vFits = volunteer.side === 'Any' || volunteer.side !== targetPaddlerSide;

        if (pFits && vFits) {
          if (targetPaddlerSide === 'Left') {
            seatL.occupant = paddler.name;
            seatR.occupant = volunteer.name;
          } else {
            seatR.occupant = paddler.name;
            seatL.occupant = volunteer.name;
          }
          placementDecided = true;
        }
      }

      if (!placementDecided) {
        const p1L = p1.side === 'Left';
        const p1R = p1.side === 'Right';
        const p2L = p2.side === 'Left';
        const p2R = p2.side === 'Right';

        if (p1L) {
          seatL.occupant = p1.name;
          seatR.occupant = p2.name;
        } else if (p1R) {
          seatR.occupant = p1.name;
          seatL.occupant = p2.name;
        } else if (p2L) {
          seatR.occupant = p1.name;
          seatL.occupant = p2.name;
        } else if (p2R) {
          seatL.occupant = p1.name;
          seatR.occupant = p2.name;
        } else {
          const weights = getBoatWeightsNow();
          if (weights.left > weights.right) {
            if (p1.wt > p2.wt) {
              seatR.occupant = p1.name;
              seatL.occupant = p2.name;
            } else {
              seatL.occupant = p1.name;
              seatR.occupant = p2.name;
            }
          } else {
            if (p1.wt > p2.wt) {
              seatL.occupant = p1.name;
              seatR.occupant = p2.name;
            } else {
              seatR.occupant = p1.name;
              seatL.occupant = p2.name;
            }
          }
        }
      }
    }
  });

  return newBoats;
}
