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
  memberMap: Map<string, Member>,
  isDarkMode: boolean = typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark')
    : true
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

  const palette = isDarkMode
    ? {
        canvasBg: '#09090b',
        headerBg: '#18181b',
        headerBorder: '#27272a',
        titleText: '#fafafa',
        dateText: '#d4d4d8',
        rowLabelBg: '#121216',
        rowLabelBorder: '#27272a',
        rowLabelText: '#d4d4d8',
        emptyBg: '#121216',
        emptyBorder: '#27272a',
        emptyText: '#71717a',
        paddlerBg: '#0a2540',
        paddlerBorder: '#38bdf8',
        paddlerText: '#f0f9ff',
        volunteerBg: '#062e22',
        volunteerBorder: '#34d399',
        volunteerText: '#ecfdf5',
        helmBg: '#2e1c05',
        helmBorder: '#f59e0b',
        helmText: '#fffbeb',
        helmUnassignedText: '#fcd34d',
      }
    : {
        canvasBg: '#ffffff',
        headerBg: '#f4f4f5',
        headerBorder: '#e4e4e7',
        titleText: '#09090b',
        dateText: '#3f3f46',
        rowLabelBg: '#f4f4f5',
        rowLabelBorder: '#e4e4e7',
        rowLabelText: '#18181b',
        emptyBg: '#f8fafc',
        emptyBorder: '#cbd5e1',
        emptyText: '#64748b',
        paddlerBg: '#e0f2fe',
        paddlerBorder: '#38bdf8',
        paddlerText: '#082f49',
        volunteerBg: '#d1fae5',
        volunteerBorder: '#34d399',
        volunteerText: '#022c22',
        helmBg: '#fef3c7',
        helmBorder: '#f59e0b',
        helmText: '#451a03',
        helmUnassignedText: '#92400e',
      };

  // Background
  ctx.fillStyle = palette.canvasBg;
  ctx.fillRect(0, 0, canvasWidth, totalHeight);

  // Header
  ctx.fillStyle = palette.headerBg;
  ctx.fillRect(0, 0, canvasWidth, 42);
  ctx.strokeStyle = palette.headerBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 42.5);
  ctx.lineTo(canvasWidth, 42.5);
  ctx.stroke();

  ctx.fillStyle = palette.titleText;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(boatTitle, 10, 21);

  ctx.font = '600 11px monospace';
  ctx.fillStyle = palette.dateText;
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
      return {
        name: '',
        bg: palette.emptyBg,
        border: palette.emptyBorder,
        text: palette.emptyText,
      };
    }
    const member = memberMap.get(occupantName);
    if (!member) {
      return {
        name: occupantName,
        bg: palette.helmBg,
        border: palette.helmBorder,
        text: palette.helmText,
      };
    }
    if (member.type === 'Volunteer') {
      return {
        name: occupantName,
        bg: palette.volunteerBg,
        border: palette.volunteerBorder,
        text: palette.volunteerText,
      };
    }
    if (member.type === 'Paddler') {
      return {
        name: occupantName,
        bg: palette.paddlerBg,
        border: palette.paddlerBorder,
        text: palette.paddlerText,
      };
    }
    return {
      name: occupantName,
      bg: palette.helmBg,
      border: palette.helmBorder,
      text: palette.helmText,
    };
  }

  function drawRowLabelBox(y: number, line1: string, line2?: string) {
    if (!ctx) return;
    ctx.fillStyle = palette.rowLabelBg;
    ctx.fillRect(6, y, col1W, rowHeight);
    ctx.strokeStyle = palette.rowLabelBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(6.5, y + 0.5, col1W - 1, rowHeight - 1);
    ctx.fillStyle = palette.rowLabelText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (line2) {
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(line1, 6 + col1W / 2, y + 13);
      ctx.fillText(line2, 6 + col1W / 2, y + 24);
    } else {
      ctx.font = line1 === 'STEER' ? 'bold 9px sans-serif' : 'bold 12px monospace';
      ctx.fillText(line1, 6 + col1W / 2, y + rowHeight / 2);
    }
  }

  // Row Coach / Drum
  drawRowLabelBox(currY, 'COACH', 'DRUM');

  const drummerSeat = boat.seats.find((s) => s.role === 'drummer');
  const drummerInfo = getSeatInfo(drummerSeat?.occupant);
  drawBox(
    6 + col1W + gap,
    currY,
    seatW * 2 + gap,
    rowHeight,
    drummerInfo.name ? drummerInfo.bg : palette.helmBg,
    palette.helmBorder,
    drummerInfo.name ? drummerInfo.text : palette.helmUnassignedText,
    drummerInfo.name || 'Unassigned'
  );

  currY += rowHeight + gap;

  // Numbered rows
  for (let i = 1; i <= numRows; i++) {
    drawRowLabelBox(currY, String(i));

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
  drawRowLabelBox(currY, 'STEER');

  const helmSeat = boat.seats.find((s) => s.role === 'helm');
  const helmInfo = getSeatInfo(helmSeat?.occupant);
  drawBox(
    6 + col1W + gap,
    currY,
    seatW * 2 + gap,
    rowHeight,
    helmInfo.name ? helmInfo.bg : palette.helmBg,
    palette.helmBorder,
    helmInfo.name ? helmInfo.text : palette.helmUnassignedText,
    helmInfo.name || 'Unassigned'
  );

  return canvas.toDataURL('image/jpeg', 0.96);
}
