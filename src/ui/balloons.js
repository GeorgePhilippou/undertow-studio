// Balloon Help in the manner of System 7: point at (or touch) anything with a
// data-help attribute to see what it does. The same balloons run the tour.

import { escape } from './mac.js';

let balloon = null;
let hideTimer = null;

const GAP = 18; // length of the tail
const MARGIN = 8;
const TOP = 30; // keep clear of the menu bar
const TAIL_MIN = 10;

// Tries each side in turn and keeps the first where the balloon fits on screen
// and its tail can reach the target. Targets in the menu bar always get a
// balloon below them.
function choosePlacement(box, width, height) {
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;
  const anchorX = box.left + Math.min(box.width, 120) / 2;
  const anchorY = box.top + Math.min(box.height, 60) / 2;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const sides = box.bottom <= 40 ? ['below', 'right', 'left', 'above'] : ['right', 'below', 'left', 'above'];
  const candidates = sides.map(side => {
    if (side === 'right' || side === 'left') {
      const left = side === 'right' ? box.right + GAP : box.left - GAP - width;
      const top = clamp(anchorY - 24, TOP, viewHeight - height - MARGIN);
      const tail = anchorY - top - 8;
      return {
        side, left, top, tail,
        fits: left >= MARGIN && left + width <= viewWidth - MARGIN && top + height <= viewHeight - MARGIN,
        reaches: tail >= TAIL_MIN && tail <= height - 16 - TAIL_MIN,
        tipX: side === 'right' ? left - GAP : left + width + GAP,
      };
    }
    const top = side === 'below' ? box.bottom + GAP : box.top - GAP - height;
    const left = clamp(anchorX - 30, MARGIN, viewWidth - width - MARGIN);
    const tail = anchorX - left - 8;
    return {
      side, left, top, tail,
      fits: top >= TOP - 4 && top + height <= viewHeight - MARGIN,
      reaches: tail >= TAIL_MIN && tail <= width - 16 - TAIL_MIN,
      tipY: side === 'below' ? top - GAP : top + height + GAP,
    };
  });
  const best = candidates.find(c => c.fits && c.reaches) || candidates.find(c => c.fits) || candidates[0];
  const vertical = best.side === 'right' || best.side === 'left';
  best.tail = clamp(best.tail, TAIL_MIN, (vertical ? height : width) - 16 - TAIL_MIN);
  if (vertical) best.tipY = best.top + best.tail + 8;
  else best.tipX = best.left + best.tail + 8;
  return best;
}

export function showBalloon(target, html, { buttons = '' } = {}) {
  hideBalloon();
  balloon = document.createElement('div');
  balloon.className = 'balloon';
  balloon.setAttribute('role', 'tooltip');
  balloon.innerHTML = `<div class="balloon-text">${html}</div>${buttons ? `<div class="balloon-buttons">${buttons}</div>` : ''}`;
  document.body.append(balloon);
  const width = balloon.offsetWidth;
  const height = balloon.offsetHeight;
  const place = choosePlacement(target.getBoundingClientRect(), width, height);
  balloon.style.left = `${place.left}px`;
  balloon.style.top = `${place.top}px`;
  balloon.style.setProperty('--tail', `${place.tail}px`);
  balloon.classList.add(place.side);
  // Where the tail's tip lands, kept for checks.
  balloon.dataset.tipX = Math.round(place.tipX);
  balloon.dataset.tipY = Math.round(place.tipY);
  return balloon;
}

export function hideBalloon() {
  clearTimeout(hideTimer);
  balloon?.remove();
  balloon = null;
}

export class BalloonHelp {
  constructor() {
    this.enabled = false;
    this.current = null;
    document.addEventListener('pointerover', event => {
      if (!this.enabled || event.pointerType === 'touch') return;
      this.point(event.target);
    });
    document.addEventListener('pointerdown', event => {
      if (!this.enabled || event.pointerType === 'mouse') return;
      this.point(event.target, true);
    }, true);
  }

  point(element, touch = false) {
    const target = element.closest?.('[data-help]');
    if (!target || target === this.current) {
      if (!target && !touch) {
        this.current = null;
        hideBalloon();
      }
      return;
    }
    this.current = target;
    showBalloon(target, escape(target.dataset.help));
    if (touch) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        this.current = null;
        hideBalloon();
      }, 4500);
    }
  }

  toggle(on = !this.enabled) {
    this.enabled = on;
    this.current = null;
    hideBalloon();
    return on;
  }
}

// Walks through a list of { target, text } steps, one balloon at a time.
export function runTour(steps) {
  return new Promise(resolve => {
    let index = 0;
    const show = () => {
      const step = steps[index];
      const target = typeof step.target === 'function' ? step.target() : document.querySelector(step.target);
      if (!target || !target.getClientRects().length) {
        next();
        return;
      }
      const last = index === steps.length - 1;
      const element = showBalloon(target, `<b>${index + 1} of ${steps.length}</b><br>${escape(step.text)}`, {
        buttons: `${last ? '' : '<button class="btn" data-tour="skip">Skip</button>'}<button class="btn default" data-tour="next">${last ? 'Done' : 'Next'}</button>`,
      });
      element.classList.add('tour');
      if (typeof step.target === 'string') element.dataset.target = step.target;
      element.addEventListener('click', event => {
        const action = event.target.closest('[data-tour]')?.dataset.tour;
        if (action === 'next') next();
        if (action === 'skip') finish();
      });
    };
    const next = () => {
      index++;
      if (index >= steps.length) finish();
      else show();
    };
    const finish = () => {
      hideBalloon();
      resolve();
    };
    show();
  });
}
