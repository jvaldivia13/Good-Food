// kitchen.js — KDS (Kitchen Display System): kanban por estación en tiempo real
const Render = window.Render || (window.Render = {});

const STATIONS = ['cold', 'hot', 'grill', 'bar']; // Frío, Caliente, Parrilla, Barra
const STATION_NAMES = { cold: 'Frío', hot: 'Caliente', grill: 'Parrilla', bar: 'Barra' };
const STAGE_META = {
  new: { label: 'Nueva', cls: 'stage-new' },
  sent: { label: 'Aceptar', cls: 'stage-accept' },
  preparing: { label: 'Preparando', cls: 'stage-cooking' },
  ready: { label: 'Listo', cls: 'stage-ready' }
};

Render.kitchen = function () {
  renderStationTabs();
  const board = $$('kdsBoard');
  board.innerHTML = '';

  const stations = App.currentStation === 'all' ? STATIONS : [App.currentStation];
  const activeOrders = App.data.orders.filter((o) => ['open', 'preparing', 'ready'].includes(o.status));

  stations.forEach((st) => {
    const col = document.createElement('div');
    col.className = 'kds-col';
    col.innerHTML = `<h3>${STATION_NAMES[st]}</h3>`;
    const cards = [];

    activeOrders.forEach((o) => {
      const items = o.items.filter((it) => it.station === st && ['new', 'sent', 'preparing', 'ready'].includes(it.status));
      if (!items.length) return;
      const t = App.data.tables.find((x) => x.id === o.tableId);
      const oldest = Math.min(...items.map((it) => new Date(it.sentAt || o.openedAt).getTime()));
      cards.push({ o, items, t, oldest });
    });

    cards.sort((a, b) => a.oldest - b.oldest);

    if (!cards.length) {
      col.innerHTML += `<p class="muted center" style="font-size:12px;padding:12px;">Sin pedidos</p>`;
    } else {
      cards.forEach(({ o, items, t }) => {
        const mins = elapsedMin(o.openedAt);
        const timerCls = mins > 15 ? 'timer-danger' : mins > 8 ? 'timer-warn' : 'timer-ok';
        col.innerHTML += `
          <div class="kds-card">
            <div class="khead">
              <span class="tableno">Mesa ${t ? t.number : '?'}</span>
              <span class="timer ${timerCls}">${mins}'</span>
            </div>
            <ul class="kds-items">
              ${items.map((it) => `
                <li>
                  <div>
                    <span class="qty">${it.qty}</span>${esc(it.productName)}
                    ${it.notes ? `<span class="notes">📝 ${esc(it.notes)}</span>` : ''}
                  </div>
                  <button class="stage-btn ${(STAGE_META[it.status] || {}).cls}" onclick="advanceItem('${o.id}','${it.id}','${it.status}')">${it.status === 'ready' ? '✓' : (STAGE_META[it.status] || {}).label || it.status}</button>
                </li>`).join('')}
            </ul>
          </div>`;
      });
    }
    board.appendChild(col);
  });
};

function renderStationTabs() {
  const tabs = $$('stationTabs');
  if (!tabs) return;
  tabs.innerHTML = `<button class="area-tab ${App.currentStation === 'all' ? 'active' : ''}" onclick="setStation('all')">Todas</button>`;
  STATIONS.forEach((s) => {
    const b = document.createElement('button');
    b.className = 'area-tab' + (App.currentStation === s ? ' active' : '');
    b.textContent = STATION_NAMES[s];
    b.onclick = () => setStation(s);
    tabs.appendChild(b);
  });
}
function setStation(s) { App.currentStation = s; Render.kitchen(); }

function elapsedMin(d) {
  const diff = (Date.now() - new Date(d).getTime()) / 60000;
  return Math.max(0, Math.floor(diff));
}

// Avanzar estado de un ítem: new→sent→preparing→ready
function advanceItem(orderId, itemId, cur) {
  const next = cur === 'new' ? 'sent' : cur === 'sent' ? 'preparing' : cur === 'preparing' ? 'ready' : cur === 'ready' ? 'served' : 'new';
  if (next === 'served') { toast('Ítem listo ✓'); return; }
  App.socket.emit('kitchen:item-status', { orderId, itemId, status: next });
  if (navigator.vibrate) navigator.vibrate(30);
}
