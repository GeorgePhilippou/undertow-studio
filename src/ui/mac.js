// Menus, windows and dialogs in the manner of the classic Mac OS.

import { ICONS, renderIcons } from './icons.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export { escape };

// ---------------------------------------------------------------- menus

export class MenuBar {
  constructor(bar, container, build) {
    this.bar = bar;
    this.container = container;
    this.build = build; // name -> array of items
    this.open = null;
    bar.addEventListener('pointerdown', event => {
      const title = event.target.closest('.menu-title');
      if (!title) return;
      event.preventDefault();
      if (this.open === title.dataset.menu) this.close();
      else this.show(title);
    });
    bar.addEventListener('pointerover', event => {
      const title = event.target.closest('.menu-title');
      if (this.open && title && title.dataset.menu !== this.open) this.show(title);
    });
    bar.addEventListener('keydown', event => {
      const title = event.target.closest('.menu-title');
      if (title && (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown')) {
        event.preventDefault();
        this.show(title);
        this.container.querySelector('button:not(:disabled)')?.focus();
      }
    });
    document.addEventListener('pointerdown', event => {
      if (this.open && !event.target.closest('.menu, .menu-title')) this.close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.open) this.close();
    });
  }

  show(title) {
    this.close();
    const name = title.dataset.menu;
    const items = this.build(name);
    const menu = document.createElement('div');
    menu.className = 'menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', title.getAttribute('aria-label') || title.textContent);
    for (const item of items) {
      if (item === '-') {
        menu.append(document.createElement('hr'));
        continue;
      }
      if (item.header) {
        const label = document.createElement('div');
        label.className = 'menu-label';
        label.textContent = item.header;
        menu.append(label);
        continue;
      }
      const button = document.createElement('button');
      button.setAttribute('role', item.checked === undefined ? 'menuitem' : 'menuitemradio');
      if (item.checked !== undefined) button.setAttribute('aria-checked', String(Boolean(item.checked)));
      button.disabled = Boolean(item.disabled);
      button.innerHTML = `<span>${escape(item.label)}</span>${item.shortcut ? `<span class="shortcut">${escape(item.shortcut)}</span>` : ''}`;
      button.addEventListener('click', () => {
        this.close();
        item.action?.();
      });
      menu.append(button);
    }
    menu.addEventListener('keydown', event => {
      const buttons = [...menu.querySelectorAll('button:not(:disabled)')];
      const index = buttons.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') buttons[(index + 1) % buttons.length]?.focus();
      if (event.key === 'ArrowUp') buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
    });
    this.container.append(menu);
    const box = title.getBoundingClientRect();
    menu.style.left = `${Math.max(0, Math.min(box.left, window.innerWidth - menu.offsetWidth - 4))}px`;
    title.setAttribute('aria-expanded', 'true');
    this.open = name;
  }

  close() {
    this.container.replaceChildren();
    this.bar.querySelectorAll('.menu-title').forEach(t => t.setAttribute('aria-expanded', 'false'));
    this.open = null;
  }
}

// ---------------------------------------------------------------- windows

export function setupWindows(onClose) {
  for (const win of document.querySelectorAll('.window')) {
    win.addEventListener('pointerdown', () => activate(win));
    win.querySelector('[data-shade]')?.addEventListener('click', () => win.classList.toggle('shaded'));
    win.querySelector('[data-close]')?.addEventListener('click', () => onClose(win));
    win.querySelector('.titlebar')?.addEventListener('dblclick', event => {
      if (!event.target.closest('.box')) win.classList.toggle('shaded');
    });
    if (win.classList.contains('floating')) makeDraggable(win);
  }
}

export function activate(win) {
  document.querySelectorAll('.window.active').forEach(w => w !== win && w.classList.remove('active'));
  win.classList.add('active');
  if (win.classList.contains('floating')) {
    document.querySelectorAll('.floating').forEach(w => (w.style.zIndex = 30));
    win.style.zIndex = 31;
  }
}

export function openFloating(win, anchor) {
  win.hidden = false;
  if (!win.dataset.placed) {
    const box = anchor?.getBoundingClientRect();
    const left = box ? box.left + 40 : 80;
    const top = box ? box.top + 30 : 80;
    win.style.left = `${Math.max(8, Math.min(left, window.innerWidth - win.offsetWidth - 8))}px`;
    win.style.top = `${Math.max(32, Math.min(top, window.innerHeight - win.offsetHeight - 8))}px`;
    win.dataset.placed = '1';
  }
  activate(win);
}

function makeDraggable(win) {
  const bar = win.querySelector('.titlebar');
  let drag = null;
  bar.addEventListener('pointerdown', event => {
    if (event.target.closest('.box')) return;
    drag = { id: event.pointerId, x: event.clientX - win.offsetLeft, y: event.clientY - win.offsetTop };
    bar.setPointerCapture(event.pointerId);
  });
  bar.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const left = Math.max(-win.offsetWidth + 80, Math.min(event.clientX - drag.x, window.innerWidth - 60));
    const top = Math.max(26, Math.min(event.clientY - drag.y, window.innerHeight - 30));
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
  });
  const end = () => (drag = null);
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', end);
}

// ---------------------------------------------------------------- dialogs

const dialog = () => document.getElementById('dialog');

// Shows HTML in the modal dialog. Buttons with data-value close it and resolve
// the promise with that value; the form's fields are returned alongside.
export function showDialog(html, { defaultValue = 'ok' } = {}) {
  const element = dialog();
  const body = document.getElementById('dialog-body');
  body.innerHTML = html;
  renderIcons(body);
  return new Promise(resolve => {
    const finish = value => {
      const fields = Object.fromEntries([...body.querySelectorAll('[name]')].map(input => [input.name, input.value]));
      element.close();
      body.removeEventListener('click', onClick);
      element.removeEventListener('cancel', onCancel);
      resolve({ value, fields });
    };
    const onClick = event => {
      const button = event.target.closest('[data-value]');
      if (button) finish(button.dataset.value);
    };
    const onCancel = event => {
      event.preventDefault();
      finish('cancel');
    };
    body.addEventListener('click', onClick);
    element.addEventListener('cancel', onCancel);
    body.querySelector('form')?.addEventListener('submit', event => {
      event.preventDefault();
      finish(defaultValue);
    });
    element.showModal();
    (body.querySelector('input, select') || body.querySelector('.default'))?.focus();
  });
}

export function alertBox(message, detail = '') {
  return showDialog(`
    <div class="alert">${ICONS.alert}<div><h3>${escape(message)}</h3>${detail ? `<p>${escape(detail)}</p>` : ''}</div></div>
    <div class="button-row"><button class="btn default" data-value="ok">OK</button></div>`);
}

export function confirmBox(message, detail, action = 'OK') {
  return showDialog(`
    <div class="alert">${ICONS.alert}<div><h3>${escape(message)}</h3><p>${escape(detail)}</p></div></div>
    <div class="button-row"><button class="btn" data-value="cancel">Cancel</button><button class="btn default" data-value="ok">${escape(action)}</button></div>`)
    .then(result => result.value === 'ok');
}

let toastTimer = null;

export function toast(message) {
  let element = document.querySelector('.toast');
  if (!element) {
    element = document.createElement('div');
    element.className = 'toast';
    element.setAttribute('role', 'status');
    document.body.append(element);
  }
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (element.hidden = true), 2600);
}
