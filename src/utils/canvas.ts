import { Boat, Member } from '../types';

export function dataUrlToImageFile(dataUrl: string, filename: string): File {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(parts[1] || '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

export function generateBoatCanvasDataUrl(
  boat: Boat,
  boatTitle: string,
  displayDate: string,
  memberMap: Map<string, Member>
): string {
  const scale = 3;
  const canvasWidth = 300;
  const rowHeight = 36;
  const col1W = 44;
  const seatW = 120;
  const gap = 3;

  const numRows = boat.type === 'standard' ? 10 : 5;
  const totalHeight = 48 + (rowHeight + gap) * (numRows + 2) + 8;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth * scale;
  canvas.height = totalHeight * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, canvasWidth, totalHeight);

  // Header
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, canvasWidth, 42);

  ctx.fillStyle = '#fafafa';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(boatTitle, 10, 21);

  ctx.font = '600 11px monospace';
  ctx.fillStyle = '#d4d4d8';
  ctx.textAlign = 'right';
  ctx.fillText(displayDate, canvasWidth - 10, 21);

  let currY = 48;

  function drawBox(
    x: number,
    y: number,
    w: number,
    h: number,
    bgColor: string,
    borderColor: string,
    textColor: string,
    text: string
  ) {
    if (!ctx) return;
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    if (text) {
      ctx.fillStyle = textColor;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let displayName = text;
      if (ctx.measureText(displayName).width > w - 10) {
        while (displayName.length > 4 && ctx.measureText(displayName + '…').width > w - 10) {
          displayName = displayName.slice(0, -1);
        }
        displayName += '…';
      }
      ctx.fillText(displayName, x + w / 2, y + h / 2);
    }
  }

  function getSeatInfo(occupantName: string | null | undefined): {
    name: string;
    bg: string;
    border: string;
    text: string;
  } {
    if (!occupantName) {
      return { name: '', bg: '#121216', border: '#27272a', text: '#71717a' };
    }
    const member = memberMap.get(occupantName);
    if (!member) {
      return { name: occupantName, bg: '#1f1405', border: '#f59e0b', text: '#fef3c7' };
    }
    if (member.type === 'Volunteer') {
      return { name: occupantName, bg: '#062219', border: '#10b981', text: '#ecfdf5' };
    }
    if (member.type === 'Paddler') {
      return { name: occupantName, bg: '#081c2e', border: '#38bdf8', text: '#f0f9ff' };
    }
    return { name: occupantName, bg: '#1f1405', border: '#f59e0b', text: '#fef3c7' };
  }

  // Row Coach / Drum
  ctx.fillStyle = '#121216';
  ctx.fillRect(6, currY, col1W, rowHeight);
  ctx.fillStyle = '#d4d4d8';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('COACH', 6 + col1W / 2, currY + 13);
  ctx.fillText('DRUM', 6 + col1W / 2, currY + 24);

  const drummerSeat = boat.seats.find((s) => s.role === 'drummer');
  const drummerInfo = getSeatInfo(drummerSeat?.occupant);
  drawBox(
    6 + col1W + gap,
    currY,
    seatW * 2 + gap,
    rowHeight,
    drummerInfo.name ? drummerInfo.bg : '#1f1405',
    '#f59e0b',
    drummerInfo.name ? drummerInfo.text : '#fcd34d',
    drummerInfo.name || 'Unassigned'
  );

  currY += rowHeight + gap;

  // Numbered rows
  for (let i = 1; i <= numRows; i++) {
    ctx.fillStyle = '#121216';
    ctx.fillRect(6, currY, col1W, rowHeight);
    ctx.fillStyle = '#d4d4d8';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i), 6 + col1W / 2, currY + rowHeight / 2);

    const leftSeat = boat.seats.find((s) => s.row === i && s.side === 'Left');
    const rightSeat = boat.seats.find((s) => s.row === i && s.side === 'Right');

    const leftInfo = getSeatInfo(leftSeat?.occupant);
    const rightInfo = getSeatInfo(rightSeat?.occupant);

    drawBox(
      6 + col1W + gap,
      currY,
      seatW,
      rowHeight,
      leftInfo.bg,
      leftInfo.border,
      leftInfo.text,
      leftInfo.name
    );
    drawBox(
      6 + col1W + gap + seatW + gap,
      currY,
      seatW,
      rowHeight,
      rightInfo.bg,
      rightInfo.border,
      rightInfo.text,
      rightInfo.name
    );

    currY += rowHeight + gap;
  }

  // Steer row
  ctx.fillStyle = '#121216';
  ctx.fillRect(6, currY, col1W, rowHeight);
  ctx.fillStyle = '#d4d4d8';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('STEER', 6 + col1W / 2, currY + rowHeight / 2);

  const helmSeat = boat.seats.find((s) => s.role === 'helm');
  const helmInfo = getSeatInfo(helmSeat?.occupant);
  drawBox(
    6 + col1W + gap,
    currY,
    seatW * 2 + gap,
    rowHeight,
    helmInfo.name ? helmInfo.bg : '#1f1405',
    '#f59e0b',
    helmInfo.name ? helmInfo.text : '#fcd34d',
    helmInfo.name || 'Unassigned'
  );

  return canvas.toDataURL('image/jpeg', 0.96);
}
