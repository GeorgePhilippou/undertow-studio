// Piano-roll view of the part you are playing, one page at a time.
// drawRoll returns the layout so taps can be turned back into beats and rows.

import { DRUM_LABELS, DRUM_VOICES } from '../audio/drums.js';
import { barLines } from '../songs.js';

let grayTile = null;
let lightTile = null;

function tile(pattern) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = pattern.length;
  const t = canvas.getContext('2d');
  t.fillStyle = '#fff';
  t.fillRect(0, 0, canvas.width, canvas.height);
  t.fillStyle = '#000';
  pattern.forEach((row, y) => [...row].forEach((c, x) => c === '#' && t.fillRect(x, y, 1, 1)));
  return canvas;
}

function gray(context) {
  grayTile ||= tile(['#.', '.#']);
  return context.createPattern(grayTile, 'repeat');
}

function light(context) {
  lightTile ||= tile(['#...', '....', '..#.', '....']);
  return context.createPattern(lightTile, 'repeat');
}

export function pageLength(song) {
  return Math.min(song.loop, song.cycle * Math.max(1, Math.round(16 / song.cycle)));
}

function check(c, x, y) {
  c.fillRect(x, y + 3, 2, 2);
  c.fillRect(x + 2, y + 5, 2, 2);
  c.fillRect(x + 4, y + 3, 2, 2);
  c.fillRect(x + 6, y + 1, 2, 2);
  c.fillRect(x + 8, y - 1, 2, 2);
}

function cross(c, x, y) {
  for (let i = 0; i < 4; i++) {
    c.fillRect(x + i * 2, y + i * 2 - 1, 2, 2);
    c.fillRect(x + 6 - i * 2, y + i * 2 - 1, 2, 2);
  }
}

export function drawRoll(canvas, view) {
  const { song, part, events, position, target, playing, section, selecting, marks, offset = 0, countIn, editing } = view;
  const ratio = Math.max(1, Math.round(window.devicePixelRatio || 1));
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return null;
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
  c.font = '16px Geneva, sans-serif';
  c.textBaseline = 'middle';

  const drums = part?.kind === 'drums';
  const span = pageLength(song);
  const start = Math.floor(Math.max(0, position) / span) * span;
  const end = Math.min(song.loop, start + span);
  const gutter = drums ? 58 : 6;
  const header = 22;
  const x = beat => Math.round(gutter + ((beat - start) / span) * (width - gutter - 6));

  // Rows: pitches for notes, voices for drums. Editing adds room around the part.
  let rows;
  if (drums) {
    rows = editing ? DRUM_VOICES : [...new Set(events.map(e => e.drum))];
    if (!rows.length) rows = DRUM_VOICES;
  } else {
    const pitches = events.flatMap(e => e.notes);
    const pad = editing ? 4 : 1;
    const low = pitches.length ? Math.min(...pitches) - pad : 55;
    const high = pitches.length ? Math.max(...pitches) + pad : 72;
    rows = [];
    for (let p = high; p >= low; p--) rows.push(p);
  }
  const rowHeight = Math.max(2, Math.min(drums ? 24 : 10, (height - header - 6) / Math.max(1, rows.length)));
  const top = header + Math.max(0, (height - header - 4 - rowHeight * rows.length) / 2);
  const y = row => top + rows.indexOf(row) * rowHeight;

  // Looped section: shade everything outside it.
  const range = selecting || section;
  if (range) {
    c.fillStyle = light(c);
    if (range.start > start) c.fillRect(x(start), header, x(Math.min(end, range.start)) - x(start), height - header);
    if (range.end < end) c.fillRect(x(Math.max(start, range.end)), header, x(end) - x(Math.max(start, range.end)), height - header);
    c.fillStyle = '#000';
    const left = x(Math.max(start, range.start));
    const right = x(Math.min(end, range.end));
    if (right > left) c.fillRect(left, 0, right - left, header - 1);
  }

  // Editing rows get a faint guide for each C and each drum lane.
  if (editing && !drums) {
    c.fillStyle = gray(c);
    rows.forEach(row => row % 12 === 0 && c.fillRect(gutter, Math.round(y(row) + rowHeight - 1), width - gutter, 1));
  }

  // Header line, bars and beats.
  c.fillStyle = '#000';
  c.fillRect(0, header - 1, width, 1);
  const bars = barLines(song);
  bars.forEach((bar, index) => {
    if (bar < start || bar >= end) return;
    c.fillStyle = '#000';
    c.fillRect(x(bar), 0, 1, height);
    const inside = range && bar >= range.start && bar < range.end;
    c.fillStyle = inside ? '#fff' : '#000';
    c.fillText(String(index + 1), x(bar) + 4, header / 2);
  });
  c.fillStyle = gray(c);
  for (let beat = Math.ceil(start); beat < end; beat++) {
    if (!bars.includes(beat)) c.fillRect(x(beat), header, 1, height - header);
  }
  if (drums) {
    c.fillStyle = '#fff';
    c.fillRect(0, header, gutter - 4, height - header);
    c.fillStyle = '#000';
    rows.forEach(row => c.fillText(DRUM_LABELS[row] || row, 6, y(row) + rowHeight / 2));
    c.fillRect(gutter - 4, header, 1, height - header);
  }

  // Chord names along the header.
  let lastChord = null;
  for (const event of events) {
    if (!event.chord || event.chord === lastChord) continue;
    lastChord = event.chord;
    if (event.beat < start || event.beat >= end) continue;
    const labelX = x(event.beat) + 18;
    const textWidth = c.measureText(event.chord).width;
    const inside = range && event.beat >= range.start && event.beat < range.end;
    c.fillStyle = inside ? '#000' : '#fff';
    c.fillRect(labelX - 3, 2, textWidth + 6, header - 5);
    c.fillStyle = inside ? '#fff' : '#000';
    c.fillText(event.chord, labelX, header / 2);
  }

  // Notes, with practice marks above the first note of each chord.
  const marked = new Set();
  for (const event of events) {
    if (event.beat < start - 1e-6 || event.beat >= end) continue;
    const left = x(event.beat);
    const right = Math.max(left + 4, x(Math.min(end, event.beat + Math.max(event.length, drums ? 0.25 : 0.1))) - 2);
    const isTarget = target && Math.abs(target - event.beat) < 1e-3;
    const isSounding = playing && event.beat <= position && position < event.beat + Math.max(event.length, 0.2);
    const markKey = Math.round((event.beat - offset) * 1000) / 1000;
    const mark = (!section || (event.beat >= section.start && event.beat < section.end)) ? marks?.get(markKey) : null;
    for (const row of drums ? [event.drum] : event.notes) {
      if (!rows.includes(row)) continue;
      const rowY = Math.round(y(row) + 1);
      const h = Math.max(2, Math.floor(rowHeight - 2));
      if (isTarget) {
        c.fillStyle = gray(c);
        c.fillRect(left - 1, rowY - 1, right - left + 2, h + 2);
        c.strokeStyle = '#000';
        c.strokeRect(left - 1.5, rowY - 1.5, right - left + 3, h + 3);
      } else if (mark === 'miss') {
        c.strokeStyle = '#000';
        c.strokeRect(left + 0.5, rowY + 0.5, right - left - 1, h - 1);
      } else {
        c.fillStyle = '#000';
        c.globalAlpha = drums ? 0.4 + event.velocity * 0.6 : 1;
        c.fillRect(left, rowY, right - left, h);
        c.globalAlpha = 1;
      }
      if (isSounding && h > 3) {
        c.fillStyle = '#fff';
        c.fillRect(left + 2, rowY + 2, right - left - 4, h - 4);
      }
    }
    if (mark && !marked.has(markKey)) {
      marked.add(markKey);
      const topRow = drums ? event.drum : Math.max(...event.notes);
      const markY = Math.max(header + 2, Math.round(y(topRow)) - 12);
      c.fillStyle = '#fff';
      c.fillRect(left - 1, markY - 2, 13, 12);
      c.fillStyle = '#000';
      if (mark === 'hit') check(c, left, markY);
      else if (mark === 'miss') cross(c, left + 1, markY);
      else c.fillRect(left, markY + 3, 9, 2);
    }
  }

  // Playhead.
  if (position >= 0 && playing) {
    const px = x(position);
    c.fillStyle = '#000';
    c.fillRect(px - 1, header, 2, height - header);
    c.beginPath();
    c.moveTo(px - 6, header - 8);
    c.lineTo(px + 6, header - 8);
    c.lineTo(px, header - 1);
    c.fill();
  }

  // Count-in number.
  if (countIn) {
    const size = Math.min(96, height - header - 10);
    c.font = `${size}px Chicago, sans-serif`;
    c.textAlign = 'center';
    const box = size * 1.1;
    c.fillStyle = '#fff';
    c.fillRect(width / 2 - box / 2, header + (height - header) / 2 - box / 2, box, box);
    c.strokeStyle = '#000';
    c.lineWidth = 2;
    c.strokeRect(width / 2 - box / 2, header + (height - header) / 2 - box / 2, box, box);
    c.lineWidth = 1;
    c.fillStyle = '#000';
    c.fillText(String(countIn), width / 2, header + (height - header) / 2 + 2);
    c.textAlign = 'left';
  }

  return {
    header,
    beatAt: px => start + ((px - gutter) / (width - gutter - 6)) * span,
    rowAt: py => rows[Math.floor((py - top) / rowHeight)],
    start,
    end,
    rowHeight,
    drums,
  };
}
