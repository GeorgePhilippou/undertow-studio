// Balloon Help in the manner of System 7: point at (or touch) anything with a
// data-help attribute to see what it does. The same balloons run the tour.

import { escape } from './mac.js';

let balloon = null;
let hideTimer = null;

export function showBalloon(target, html, { buttons = '' } = {}) {
  hideBalloon();
  const box = target.getBoundingClientRect();
  balloon = document.createElement('div');
  balloon.className = 'balloon';
  balloon.setAttribute('role', 'tooltip');
  balloon.innerHTML = `<div class="balloon-text">${html}</div>${buttons ? `<div class="balloon-buttons">${buttons}</div>` : ''}`;
  document.body.append(balloon);
  const width = balloon.offsetWidth;
  const height = balloon.offsetHeight;
  const gap = 18;
  const room = {
    right: window.innerWidth - box.right,
    left: box.left,
    below: window.innerHeight - box.bottom,
    above: box.top - 26,
  };
  let side;
  if (room.right >= width + gap + 8) side = 'right';
  else if (room.below >= height + gap + 8) side = 'below';
  else if (room.left >= width + gap + 8) side = 'left';
  else side = 'above';
  let left;
  let top;
  if (side === 'right' || side === 'left') {
    left = side === 'right' ? box.right + gap : box.left - gap - width;
    top = Math.min(Math.max(30, box.top + Math.min(box.height, 60) / 2 - 24), window.innerHeight - height - 8);
  } else {
    left = Math.min(Math.max(8, box.left + Math.min(box.width, 120) / 2 - 30), window.innerWidth - width - 8);
    top = side === 'below' ? box.bottom + gap : Math.max(30, box.top - gap - height);
  }
  balloon.style.left = `${left}px`;
  balloon.style.top = `${top}px`;
  balloon.classList.add(side);
  // Point the tail at the middle of the target, as far as the balloon allows.
  if (side === 'right' || side === 'left') {
    balloon.style.setProperty('--tail', `${Math.max(14, Math.min(height - 28, box.top + Math.min(box.height, 60) / 2 - top - 8))}px`);
  } else {
    balloon.style.setProperty('--tail', `${Math.max(14, Math.min(width - 28, box.left + Math.min(box.width, 120) / 2 - left - 8))}px`);
  }
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
