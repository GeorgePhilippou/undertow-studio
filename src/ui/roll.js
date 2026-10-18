// Piano-roll view of the part you are playing, one page at a time.

import { DRUM_LABELS } from '../audio/drums.js';
import { barLines } from '../songs.js';

let grayPattern = null;

function gray(context) {
  if (!grayPattern) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 2;
    const t = tile.getContext('2d');
    t.fillStyle = '#fff';
    t.fillRect(0, 0, 2, 2);
    t.fillStyle = '#000';
    t.fillRect(0, 0, 1, 1);
    t.fillRect(1, 1, 1, 1);
    grayPattern = tile;
  }
  return context.createPattern(grayPattern, 'repeat');
}

export function pageLength(song) {
  return Math.min(song.loop, song.cycle * Math.max(1, Math.round(16 / song.cycle)));
}

export function drawRoll(canvas, { song, part, events, loopBeat, target, playing }) {
  const ratio = Math.max(1, Math.round(window.devicePixelRatio || 1));
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
    canvas.width = width * ratio;
    canvas.height = height * ratio;
  }
  const c = canvas.getContext('2d');
  c.setTransform(ratio, 0, 0, ratio, 0, 0);
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#fff';
  c.fillRect(0, 0, width, height);
  c.fillStyle = '#000';
  c.strokeStyle = '#000';
  c.font = '16px Geneva, sans-serif';
  c.textBaseline = 'middle';

  const drums = part?.kind === 'drums';
  const span = pageLength(song);
  const position = Math.max(0, loopBeat);
  const start = Math.floor(position / span) * span;
  const end = Math.min(song.loop, start + span);
  const gutter = drums ? 58 : 6;
  const header = 22;
  const x = beat => Math.round(gutter + ((beat - start) / span) * (width - gutter - 6));

  // Rows: pitches for notes, voices for drums.
  let rows;
  if (drums) {
    rows = [...new Set(events.map(e => e.drum))];
  } else {
    const pitches = events.flatMap(e => e.notes);
    const low = pitches.length ? Math.min(...pitches) - 1 : 48;
    const high = pitches.length ? Math.max(...pitches) + 1 : 72;
    rows = [];
    for (let p = high; p >= low; p--) rows.push(p);
  }
  const rowHeight = Math.max(2, Math.min(drums ? 24 : 10, (height - header - 6) / Math.max(1, rows.length)));
  const top = header + Math.max(0, (height - header - 4 - rowHeight * rows.length) / 2);
  const y = row => top + rows.indexOf(row) * rowHeight;

  // Header line, bars and beats.
  c.fillRect(0, header - 1, width, 1);
  const bars = barLines(song);
  bars.forEach((bar, index) => {
    if (bar < start || bar >= end) return;
    c.fillRect(x(bar), 0, 1, height);
    c.fillText(String(index + 1), x(bar) + 4, header / 2);
  });
  c.fillStyle = gray(c);
  for (let beat = Math.ceil(start); beat < end; beat++) {
    if (!bars.includes(beat)) c.fillRect(x(beat), header, 1, height - header);
  }
  if (drums) {
    c.fillStyle = '#000';
    rows.forEach(row => c.fillText(DRUM_LABELS[row] || row, 6, y(row) + rowHeight / 2));
    c.fillRect(gutter - 4, header, 1, height - header);
  }

  // Chord names along the header.
  c.fillStyle = '#000';
  let lastChord = null;
  for (const event of events) {
    if (!event.chord || event.chord === lastChord) continue;
    lastChord = event.chord;
    if (event.beat < start || event.beat >= end) continue;
    const label = event.chord;
    const labelX = x(event.beat) + 16;
    const textWidth = c.measureText(label).width;
    c.fillStyle = '#fff';
    c.fillRect(labelX - 3, 2, textWidth + 6, header - 5);
    c.fillStyle = '#000';
    c.fillText(label, labelX, header / 2);
  }

  // Notes.
  for (const event of events) {
    if (event.beat < start - 1e-6 || event.beat >= end) continue;
    const left = x(event.beat);
    const right = Math.max(left + 4, x(Math.min(end, event.beat + Math.max(event.length, drums ? 0.25 : 0.1))) - 2);
    const isTarget = target && Math.abs(target.beat - event.beat) < 1e-3;
    const isSounding = playing && event.beat <= position && position < event.beat + Math.max(event.length, 0.2);
    for (const row of drums ? [event.drum] : event.notes) {
      const rowY = Math.round(y(row) + 1);
      const h = Math.max(2, Math.floor(rowHeight - 2));
      if (isTarget) {
        c.fillStyle = gray(c);
        c.fillRect(left - 1, rowY - 1, right - left + 2, h + 2);
        c.fillStyle = '#000';
        c.strokeRect(left - 1.5, rowY - 1.5, right - left + 3, h + 3);
      } else {
        c.fillStyle = '#000';
        c.globalAlpha = drums ? 0.4 + event.velocity * 0.6 : 1;
        c.fillRect(left, rowY, right - left, h);
        c.globalAlpha = 1;
      }
      if (isSounding && h > 3) {
        c.fillStyle = '#fff';
        c.fillRect(left + 2, rowY + 2, right - left - 4, h - 4);
        c.fillStyle = '#000';
      }
    }
  }

  // Playhead.
  if (loopBeat >= 0) {
    const px = x(position);
    c.fillStyle = '#000';
    c.fillRect(px - 1, header, 2, height - header);
    c.beginPath();
    c.moveTo(px - 6, header - 8);
    c.lineTo(px + 6, header - 8);
    c.lineTo(px, header - 1);
    c.fill();
  }
}
