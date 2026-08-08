// admin.js — Módulo admin/super_admin: órdenes activas, gestión de menú, dashboard KPIs
const Render = window.Render || (window.Render = {});

// ---------- Órdenes activas (cashier + admin) ----------
Render.orders = function () {
  const list = $$('ordersList');
  list.innerHTML = '';
  const active = App.data.orders.filter((o) => ['open', 'preparing', 'ready', 'bill'].includes(o.status));
  if (!active.length) {
    list.innerHTML = `<p class="muted center">No hay órdenes activas.</p>`;
    return;
  }
  active.forEach((o) => {
    const t = App.data.tables.find((x) => x.id === o.tableId);
    const items = o.items.filter((i) => ['new', 'sent', 'preparing', 'ready'].includes(i.status));
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="font-weight:700;font-size:16px;">Mesa ${t ? t.number : '?'} · ${o.id}</div>
        <span class="role-chip">${o.status}</span>
      </div>
      <div class="muted" style="font-size:12px;margin-bottom:6px;">Abierta ${fmtTime(o.openedAt)} · ${items.length} ítem(s)</div>
      <div class="cart-total" style="font-size:16px;">Total: ${money(o.total)}</div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        ${o.status === 'bill' ? `<button class="btn btn-success mini" onclick="renderPay('${o.id}')">Cobrar</button>` : ''}
      </div>`;
    list.appendChild(card);
  });
};

// ---------- Gestión de menú ----------
Render.menu = function () {
  const cats = App.data.categories.filter((c) => c.active);
  const tabs = $$('menuCatTabs');
  tabs.innerHTML = cats.map((c) => `<button class="cat-tab ${App.currentMenuCat === c.id ? 'active' : ''}" onclick="setMenuCatMenu('${c.id}')">${esc(c.name)}</button>`).join('');
  const catId = App.currentMenuCat || cats[0]?.id;
  const grid = $$('menuGrid');
  grid.innerHTML = '';
  App.data.products.filter((p) => p.categoryId === catId).forEach((p) => {
    const el = document.createElement('div');
    el.className = 'prod-card' + (p.available ? '' : ' unavail');
    el.innerHTML = `
      <div class="pname">${esc(p.name)} ${p.available ? '' : '<span class="badge-unavail">No disp.</span>'}</div>
      <div class="pdesc">${esc(p.description || '')}</div>
      <div class="pprice">${money(p.price)} · est. ${p.prepTime}'</div>
      <div style="display:flex;gap:8px;margin-top:6px;">
        <button class="switch ${p.available ? 'on' : ''}" onclick="toggleProduct('${p.id}')" title="Disponible"></button>
        <button class="btn btn-ghost mini" onclick="editProduct('${p.id}')">Editar</button>
      </div>`;
    grid.appendChild(el);
  });
};
function setMenuCatMenu(id) { App.currentMenuCat = id; Render.menu(); }
function toggleProduct(id) { App.socket.emit('admin:toggle-product', { productId: id }); }
function editProduct(id) {
  const p = App.data.products.find((x) => x.id === id);
  if (p) Render.productForm(p);
}
Render.productForm = function (p) {
  p = p || {};
  const cats = App.data.categories;
  const stations = { cold: 'Frío', hot: 'Caliente', grill: 'Parrilla', bar: 'Barra' };
  openModal(`<div class="modal-box center" style="text-align:left">
    <h3 style="margin-bottom:12px;">${p.id ? 'Editar' : 'Nuevo'} producto</h3>
    <div class="field"><label>Nombre</label><input id="pf-name" value="${esc(p.name || '')}"/></div>
    <div class="field"><label>Descripción</label><input id="pf-desc" value="${esc(p.description || '')}"/></div>
    <div class="row2">
      <div class="field"><label>Precio</label><input id="pf-price" type="number" step="0.5" value="${p.price || ''}"/></div>
      <div class="field"><label>Costo</label><input id="pf-cost" type="number" step="0.5" value="${p.cost || ''}"/></div>
    </div>
    <div class="row2">
      <div class="field"><label>Categoría</label><select id="pf-cat">${cats.map((c) => `<option value="${c.id}" ${p.categoryId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Estación</label><select id="pf-station">${Object.entries(stations).map(([k, v]) => `<option value="${k}" ${p.station === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    </div>
    <div class="row2">
      <div class="field"><label>Tiempo prep. (min)</label><input id="pf-prep" type="number" value="${p.prepTime || 0}"/></div>
    </div>
    <button class="btn btn-primary btn-block" onclick="saveProduct('${p.id || ''}')">Guardar</button>
    <button class="btn btn-ghost btn-block mt" onclick="closeModal()">Cancelar</button>
  </div>`, true);
};
function saveProduct(id) {
  const data = {
    id: id || undefined,
    name: $$('pf-name').value,
    description: $$('pf-desc').value,
    price: $$('pf-price').value,
    cost: $$('pf-cost').value,
    categoryId: $$('pf-cat').value,
    station: $$('pf-station').value,
    prepTime: $$('pf-prep').value
  };
  if (!data.name) return toast('El nombre es obligatorio');
  App.socket.emit('admin:save-product', data, () => { closeModal(); toast('Producto guardado'); });
}

// ---------- Dashboard KPIs ----------
Render.dashboard = function () {
  const orders = App.data.orders.filter((o) => o.status === 'closed');
  const active = App.data.orders.filter((o) => ['open', 'preparing', 'ready', 'bill'].includes(o.status));
  let revenue = 0, tickets = 0, items = 0;
  const perHour = Array(24).fill(0);
  const prodCount = {};
  orders.forEach((o) => {
    revenue += o.total;
    tickets++;
    const h = new Date(o.closedAt).getHours();
    perHour[h] += o.total;
    o.items.forEach((it) => {
      items += it.qty;
      prodCount[it.productName] = (prodCount[it.productName] || 0) + it.qty;
    });
  });
  const avgTicket = tickets ? revenue / tickets : 0;
  const grid = $$('kpiGrid');
  grid.innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Ventas</div><div class="kpi-value">${money(revenue)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Ticket promedio</div><div class="kpi-value">${money(avgTicket)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Mesas cerradas</div><div class="kpi-value">${tickets}</div></div>
    <div class="kpi-card"><div class="kpi-label">Órdenes activas</div><div class="kpi-value">${active.length}</div></div>`;

  // Ventas por hora
  const hourChart = $$('hourChart');
  const max = Math.max(...perHour, 1);
  hourChart.innerHTML = `<div class="bar-row">${perHour.map((v, i) => v > 0 ? `<div class="bar"><span class="blabel">${i}h</span><div class="track"><div class="fill" style="width:${(v / max) * 100}%"></div></div><span class="bval">${money(v).replace(/\D/g, '')}</span></div>` : '').join('')}</div>`;

  // Top productos
  const top = $$('topProducts');
  const sorted = Object.entries(prodCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxC = sorted.length ? sorted[0][1] : 1;
  top.innerHTML = sorted.length ? `<div class="bar-row">${sorted.map(([name, c]) => `<div class="bar"><span class="blabel">${esc(name)}</span><div class="track"><div class="fill" style="width:${(c / maxC) * 100}%;background:var(--accent)"></div></div><span class="bval">${c}</span></div>`).join('')}</div>` : `<p class="muted center">Sin datos aún — cierra mesas para ver KPIs.</p>`;
};
