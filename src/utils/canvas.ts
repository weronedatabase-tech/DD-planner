import { Boat, Member } from '../types';

export function generateBoatCanvasDataUrl(
  boat: Boat,
  boatTitle: string,
  displayDate: string,
  memberMap: Map<string, Member>
): string {
  const scale = 3;
  const canvasWidth = 280;
  const rowHeight = 35;
  const col1W = 40;
  const seatW = 115;
  const gap = 2;

  const numRows = boat.type === 'standard' ? 10 : 5;
  const totalHeight = 40 + (rowHeight + gap) * (numRows + 1) + rowHeight + 20;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth * scale;
  canvas.height = totalHeight * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#f0f9ff';
  ctx.fillRect(0, 0, canvasWidth, totalHeight);

  // Header
  ctx.fillStyle = '#eff6ff';
  ctx.fillRect(0, 0, canvasWidth, 40);

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(boatTitle, 10, 20);

  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.textAlign = 'right';
  ctx.fillText(displayDate, canvasWidth - 10, 20);

  let currY = 40;

  function drawBox(x: number, y: number, w: number, h: number, color: string, text: string) {
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    if (text) {
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (ctx.measureText(text).width > w - 10) {
        const words = text.split(' ');
        if (words.length >= 2) {
          const mid = Math.floor(words.length / 2);
          const line1 = words.slice(0, mid + 1).join(' ');
          const line2 = words.slice(mid + 1).join(' ');
          ctx.fillText(line1, x + w / 2, y + h / 2 - 7);
          ctx.fillText(line2, x + w / 2, y + h / 2 + 7);
          return;
        }
      }
      ctx.fillText(text, x + w / 2, y + h / 2);
    }
  }

  function getSeatInfo(occupantName: string | null | undefined): { name: string; color: string } {
    if (!occupantName) return { name: '', color: '#ffffff' };
    const member = memberMap.get(occupantName);
    if (!member) return { name: occupantName, color: '#fde047' };
    if (member.type === 'Volunteer') return { name: occupantName, color: '#bbf7d0' };
    if (member.type === 'Paddler') return { name: occupantName, color: '#bae6fd' };
    return { name: occupantName, color: '#fde047' };
  }

  // Row Coach / Drum
  ctx.fillStyle = '#eff6ff';
  ctx.fillRect(5, currY, col1W, rowHeight);
  ctx.fillStyle = '#6b7280';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Coach', 5 + col1W / 2, currY + 10);
  ctx.fillText('Drum', 5 + col1W / 2, currY + 22);

  const drummerSeat = boat.seats.find((s) => s.role === 'drummer');
  const drummerInfo = getSeatInfo(drummerSeat?.occupant);
  drawBox(5 + col1W + gap, currY, seatW * 2 + gap, rowHeight, drummerInfo.name ? drummerInfo.color : '#fde047', drummerInfo.name);

  currY += rowHeight + gap;

  // Numbered rows
  for (let i = 1; i <= numRows; i++) {
    ctx.fillStyle = '#6b7280';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i), 5 + col1W / 2, currY + rowHeight / 2);

    const leftSeat = boat.seats.find((s) => s.row === i && s.side === 'Left');
    const rightSeat = boat.seats.find((s) => s.row === i && s.side === 'Right');

    const leftInfo = getSeatInfo(leftSeat?.occupant);
    const rightInfo = getSeatInfo(rightSeat?.occupant);

    drawBox(5 + col1W + gap, currY, seatW, rowHeight, leftInfo.color, leftInfo.name);
    drawBox(5 + col1W + gap + seatW + gap, currY, seatW, rowHeight, rightInfo.color, rightInfo.name);

    currY += rowHeight + gap;
  }

  // Steer row
  ctx.fillStyle = '#6b7280';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Steer', 5 + col1W / 2, currY + rowHeight / 2);

  const helmSeat = boat.seats.find((s) => s.role === 'helm');
  const helmInfo = getSeatInfo(helmSeat?.occupant);
  drawBox(5 + col1W + gap, currY, seatW * 2 + gap, rowHeight, helmInfo.name ? helmInfo.color : '#fde047', helmInfo.name);

  return canvas.toDataURL('image/jpeg', 1.0);
}
