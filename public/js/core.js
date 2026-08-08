// core.js — Estado global, socket, helpers compartidos
const App = {
  user: null,
  socket: null,
  data: null, // bootstrap (restaurant, tables, products, etc.)
  currentTable: null, // mesa seleccionada
  cart: [], // ítems en carrito: {productId, name, price, qty, modifiers:[{name,delta}], notes}
  orderId: null,
  currentArea: 'area1',
  currentStation: 'all',
  currentMenuCat: null,
};

const $$ = (id) => document.getElementById(id);

function money(n) {
  const v = Number(n) || 0;
  return (App.data?.restaurant?.currency || 'S/ ') + v.toFixed(2);
}

function fmtTime(d) {
  if (!d) return '--:--';
  const dt = new Date(d);
  return dt.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function toast(msg, { undo = null } = {}) {
  const wrap = $$('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast' + (undo ? ' undo' : '');
  el.innerHTML = `<span>${msg}</span>`;
  if (undo) {
    const b = document.createElement('button');
    b.className = 'undo-btn'; b.textContent = 'Deshacer';
    b.onclick = () => { undo(); el.remove(); };
    el.appendChild(b);
  }
  wrap.appendChild(el);
  setTimeout(() => el.remove(), undo ? 6000 : 2500);
  if (navigator.vibrate) navigator.vibrate(40);
}

function openModal(html, center = false) {
  const c = $$('modalContainer');
  c.innerHTML = `<div class="modal-overlay ${center ? 'center' : ''}" onclick="if(event.target===this)this.remove()">${html}</div>`;
}
function closeModal() { $$('modalContainer').innerHTML = ''; }

function roleLabel(r) {
  return { super_admin: 'Super Admin', admin: 'Administrador', waiter: 'Mozo', cashier: 'Cajero', kitchen: 'Cocina' }[r] || r;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
