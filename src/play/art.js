// Generative one-bit art for the Play screen. Each world draws a field of
// grey values that is dithered to black and white with a 4x4 Bayer matrix,
// like a classic Mac rendering a photograph. Touches send out ripples and the
// band's beat makes the picture pulse. The artwork is original.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const INK = 0xff000000;
const PAPER = 0xffffffff;

const hash = (a, b) => {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return n - Math.floor(n);
};

// Each field returns ink density (0 white, 1 black) for one pixel.
const FIELDS = {
  // Kid A: interference patterns from a weak signal, with rows that glitch.
  signal(x, y, f) {
    const { t, w, h, pulse, frame } = f;
    let v = 0.42 + 0.26 * Math.sin(x * 0.07 + Math.sin(y * 0.045 + t * 0.6) * 2.2 + t * 0.4) * Math.cos(y * 0.06 - t * 0.8);
    v += (y / h - 0.5) * 0.3 + pulse * 0.12;
    const band = y >> 2;
    if (hash(band, frame) > 0.955) v = 1 - v;
    if (hash(x >> 3, (y >> 3) + frame * 7) > 0.9985) v = 1;
    return v + (x / w) * 0.04;
  },
  // OK Computer: a night road running to the horizon, lit on the beat.
  motorway(x, y, f) {
    const { t, w, h, pulse, beat } = f;
    const horizon = h * 0.38;
    if (y < horizon) {
      const star = hash(x, y) > 0.993 && hash(x + 1, Math.floor(t * 3)) > 0.3;
      return star ? 0 : 0.88 - (y / horizon) * 0.3 - pulse * 0.08;
    }
    const d = (y - horizon) / (h - horizon);
    const z = 1 / (d + 0.03);
    const across = (x - w / 2) / (d * w * 0.9 + 1);
    const lanes = Math.abs(across * 3 - Math.round(across * 3)) < 0.03 + d * 0.02;
    const rungs = (z * 0.5 - beat * 0.5) % 1;
    const rung = rungs - Math.floor(rungs) < 0.1;
    let v = 0.62 - d * 0.35;
    if (lanes) v = 0.05;
    else if (rung) v -= 0.25 + pulse * 0.2;
    return v;
  },
  // In Rainbows: arcs of a rainbow over water, rippling outwards.
  ripples(x, y, f) {
    const { t, w, h, pulse } = f;
    const r = Math.hypot(x - w / 2, y - h * 1.1);
    const arcs = Math.sin(r * 0.085 - t * 1.2 + Math.sin(x * 0.015 + t * 0.25) * 0.35);
    const fade = Math.max(0, 1 - r / (h * 1.5));
    return 0.5 - 0.45 * Math.sign(arcs) * Math.abs(arcs) ** 0.6 * fade + (1 - y / h) * 0.1 - pulse * 0.08;
  },
};

export class Art {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.ripples = [];
    this.scale = 3;
  }

  // Art pixels are several screen pixels wide, for the chunky one-bit look.
  resize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.scale = width * height > 900000 ? 4 : 3;
    const w = Math.max(40, Math.floor(width / this.scale));
    const h = Math.max(30, Math.floor(height / this.scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.image = this.context.createImageData(w, h);
      this.pixels = new Uint32Array(this.image.data.buffer);
    }
  }

  // x and y in CSS pixels relative to the canvas.
  ripple(x, y, strength = 1) {
    this.ripples.push({ x: x / this.scale, y: y / this.scale, born: performance.now() / 1000, strength });
    if (this.ripples.length > 14) this.ripples.shift();
  }

  draw({ field, beat = 0, playing = false, level = 0, steps = 0, lit = new Set() }) {
    this.resize();
    const { width: w, height: h } = this.canvas;
    const t = performance.now() / 1000;
    const phase = playing ? beat - Math.floor(beat) : 1;
    const frame = { t, w, h, beat, pulse: playing ? Math.exp(-phase * 5) : 0, frame: Math.floor(t * 9) };
    const shade = FIELDS[field] || FIELDS.signal;
    const live = this.ripples
      .map(r => ({ ...r, age: t - r.born }))
      .filter(r => r.age < 3);
    this.ripples = this.ripples.filter(r => t - r.born < 3);
    const boost = Math.min(0.25, level * 1.5);
    const pixels = this.pixels;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      const bayerRow = (y & 3) * 4;
      for (let x = 0; x < w; x++) {
        let v = shade(x, y, frame) + boost * 0.4;
        for (const r of live) {
          const distance = Math.hypot(x - r.x, y - r.y) - r.age * 70;
          if (distance > -24 && distance < 24) v -= Math.exp(-(distance * distance) / 40) * Math.exp(-r.age * 1.3) * 0.75 * r.strength;
        }
        pixels[row + x] = v > BAYER[bayerRow + (x & 3)] ? INK : PAPER;
      }
    }
    this.context.putImageData(this.image, 0, 0);
    this.drawSteps(steps, lit, w, h);
  }

  // A row of small marks along the bottom: one per note you can play.
  drawSteps(steps, lit, w, h) {
    if (!steps) return;
    const c = this.context;
    const size = w / steps;
    for (let i = 0; i < steps; i++) {
      const left = Math.round(i * size + size / 2 - 2);
      c.fillStyle = '#fff';
      c.fillRect(left - 1, h - 7, 6, 6);
      c.fillStyle = '#000';
      if (lit.has(i)) c.fillRect(left, h - 6, 4, 4);
      else c.strokeRect(left + 0.5, h - 5.5, 3, 3);
    }
  }
}
