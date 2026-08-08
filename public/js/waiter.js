// waiter.js — Módulo del mozo: mapa de mesas, comanda, carrito, cobro
const Render = window.Render || (window.Render = {});

const TABLE_STATUS_TEXT = {
  free: 'Libre', occupied: 'Ocupada', preparing: 'En preparación', ready: 'Listo para servir',
  attention: 'Solicita atención', bill: 'Solicita cuenta', reserved: 'Reservada'
};

Render.tables = function () {
  renderAreaTabs();
  const grid = $$('tablesGrid');
  grid.innerHTML = '';
  App.data.tables
    .filter((t) => t.diningAreaId === App.currentArea)
    .forEach((t) => {
      const el = document.createElement('div');
      el.className = 'table-card st-' + t.status;
      el.innerHTML = `
        <div class="num">${t.number}</div>
        <div class="cap">${t.capacity} comensales</div>
        <div class="st">${TABLE_STATUS_TEXT[t.status]}</div>`;
      el.onclick = () => openTable(t);
      grid.appendChild(el);
    });
};

function renderAreaTabs() {
  const tabs = $$('areaTabs');
  if (!tabs) return;
  tabs.innerHTML = '';
  App.data.diningAreas.forEach((a) => {
    const b = document.createElement('button');
    b.className = 'area-tab' + (a.id === App.currentArea ? ' active' : '');
    b.textContent = a.name;
    b.onclick = () => { App.currentArea = a.id; Render.tables(); };
    tabs.appendChild(b);
  });
}

// Click en mesa: abrir sheet con acciones
function openTable(t) {
  const order = App.data.orders.find((o) => o.tableId === t.id && ['open', 'preparing', 'ready', 'bill'].includes(o.status));
  const isAdmin = ['admin', 'super_admin'].includes(App.user.role);
  let html = `<button class="sheet-close" onclick="closeModal()">×</button>`;
  html += `<h3 style="margin-bottom:4px;">Mesa ${t.number}</h3>`;
  html += `<div class="muted" style="font-size:13px;margin-bottom:12px;">${TABLE_STATUS_TEXT[t.status]} · ${t.capacity} comensales</div>`;

  if (order) {
    html += `<div class="card" style="margin-bottom:8px;">`;
    html += `<div style="font-weight:600;margin-bottom:6px;">Comanda ${order.id}</div>`;
    order.items.forEach((it) => {
      html += `<div class="cart-item"><div class="cinfo"><div class="cname">${it.qty}× ${esc(it.productName)}</div></div></div>`;
    });
    html += `<div class="cart-total">Total: ${money(order.total)}</div>`;
    html += `</div>`;
    if (App.user.role === 'waiter' || isAdmin) {
      html += `<div style="display:flex;gap:8px;flex-wrap:wrap;">`;
      if (['open', 'preparing', 'ready'].includes(order.status)) html += `<button class="btn btn-primary" onclick="requestBill('${order.id}')">Pedir cuenta</button>`;
      if (order.status === 'bill' || order.status === 'occupied' || order.status === 'ready' || order.status === 'preparing' || order.status === 'open') {
        html += `<button class="btn btn-success" onclick="renderPay('${order.id}')">Cobrar</button>`;
      }
      html += `</div>`;
    }
  } else {
    html += `<p class="muted">No hay comanda abierta en esta mesa.</p>`;
    if (App.user.role === 'waiter' || isAdmin) {
      html += `<button class="btn btn-primary btn-block mt" onclick="startOrder('${t.id}')">Nueva comanda</button>`;
    }
    if (isAdmin) {
      html += `<button class="btn btn-ghost btn-block mt" onclick="tableAttention('${t.id}')">Marcar atención</button>`;
    }
  }
  openModal(`<div class="sheet">${html}</div>`);
}

function tableAttention(tableId) {
  App.socket.emit('table:attention', { tableId, on: true });
  closeModal();
  toast('Mesa marcada para atención');
}

function startOrder(tableId) {
  App.currentTable = App.data.tables.find((t) => t.id === tableId);
  App.cart = [];
  App.orderId = null;
  $$('view-waiter').classList.remove('active');
  $$('view-command').classList.add('active');
  Render.command();
}

// Render de la vista comanda (carrito + menú para agregar)
Render.command = function () {
  const header = $$('commandHeader');
  const body = $$('commandBody');
  if (!App.currentTable) {
    header.innerHTML = '<h3 class="muted">Selecciona una mesa primero</h3>';
    body.innerHTML = '';
    return;
  }
  header.innerHTML = `<h3 style="margin:0;">Mesa ${App.currentTable.number}</h3>
    <div style="display:flex;gap:10px;margin-top:6px;">
      <button class="btn btn-ghost mini" onclick="backToTables()">← Mesas</button>
    </div>
    <div class="section-title">Añadir productos</div>`;

  // Tabs de categorías
  const cats = App.data.categories.filter((c) => c.active);
  body.innerHTML = `<div class="cat-tabs">
    ${cats.map((c) => `<button class="cat-tab ${App.currentMenuCat === c.id ? 'active' : ''}" onclick="setMenuCat('${c.id}')">${esc(c.name)}</button>`).join('')}
  </div>`;

  // Grid de productos de la categoría seleccionada
  const catId = App.currentMenuCat || cats[0]?.id;
  const prods = App.data.products.filter((p) => p.categoryId === catId);
  body.innerHTML += `<div class="prod-grid">
    ${prods.map((p) => `
      <div class="prod-card ${p.available ? '' : 'unavail'}" onclick="addToCart('${p.id}')">
        <div class="pname">${esc(p.name)}</div>
        <div class="pdesc">${esc(p.description || '')}</div>
        <div class="pprice">${money(p.price)}</div>
        ${p.available ? '' : '<span class="badge-unavail">No disponible</span>'}
      </div>`).join('')}
  </div>`;

  // Resumen del carrito
  body.innerHTML += `<div class="section-title">Comanda actual</div>`;
  if (App.cart.length === 0) {
    body.innerHTML += `<p class="muted center">Carrito vacío — toca productos para agregar.</p>`;
  } else {
    body.innerHTML += `<div class="card">`;
    App.cart.forEach((c, i) => {
      body.innerHTML += `<div class="cart-item">
        <div class="cinfo">
          <div class="cname">${esc(c.name)}</div>
          <div class="cmods">${c.modifiers.map((m) => esc(m.name)).join(', ') || '—'}${c.notes ? ' · ' + esc(c.notes) : ''}</div>
        </div>
        <div style="text-align:right;">
          <div class="cart-qty" style="justify-content:flex-end;">
            <button class="qty-btn" onclick="cartQty(${i},-1)">−</button>
            <span>${c.qty}</span>
            <button class="qty-btn" onclick="cartQty(${i},1)">+</button>
          </div>
          <div class="muted mono">${money(c.price * c.qty)}</div>
        </div>
      </div>`;
    });
    let sub = App.cart.reduce((s, c) => s + c.price * c.qty, 0);
    body.innerHTML += `<div class="cart-total">Subtotal: ${money(sub)}</div>`;
    body.innerHTML += `<button class="btn btn-primary btn-block mt" onclick="sendOrder()" ${sub === 0 ? 'disabled' : ''}>Enviar comanda a cocina</button>`;
    body.innerHTML += `</div>`;
  }
};

function backToTables() { showView('waiter'); }
function setMenuCat(id) { App.currentMenuCat = id; Render.command(); }

// Añadir producto al carrito con modificadores
function addToCart(productId) {
  const p = App.data.products.find((x) => x.id === productId);
  if (!p || !p.available) return;
  openModal(modalProduct(p));
}
function modalProduct(p) {
  const groups = App.data.modifierGroups.map((g) => {
    const mods = App.data.modifiers.filter((m) => m.groupId === g.id);
    return `<div class="mod-group"><h4>${esc(g.name)}${g.required ? ' *' : ''}</h4>
      ${mods.map((m) => `<div class="mod-opt" data-g="${g.id}" onclick="toggleMod(this,'${m.id}')" data-mode="${g.max > 1 ? 'multi' : 'single'}">
        <span>${esc(m.name)}</span><span class="checkmark"></span></div>`).join('')}
    </div>`;
  }).join('');
  return `<div class="sheet">
    <button class="sheet-close" onclick="closeModal()">×</button>
    <h3>${esc(p.name)}</h3>
    <div class="muted">${money(p.price)}</div>
    ${groups}
    <div class="field"><label>Notas</label><textarea class="notes-input" id="prodNotes" rows="2" placeholder="Ej. sin sal, punto medio"></textarea></div>
    <button class="btn btn-primary btn-block" onclick="confirmAdd('${p.id}')">Agregar al carrito</button>
  </div>`;
}
function toggleMod(el, modId) {
  const g = el.closest('.mod-group');
  const multi = el.dataset.mode === 'multi';
  if (!multi) {
    g.querySelectorAll('.mod-opt').forEach((o) => { o.classList.remove('selected'); o.querySelector('.checkmark').textContent = ''; });
    el.classList.add('selected');
    el.querySelector('.checkmark').textContent = '✓';
  } else {
    el.classList.toggle('selected');
    el.querySelector('.checkmark').textContent = el.classList.contains('selected') ? '✓' : '';
  }
}
function confirmAdd(productId) {
  const p = App.data.products.find((x) => x.id === productId);
  const sel = [];
  document.querySelectorAll('.mod-opt.selected').forEach((el) => {
    const mod = App.data.modifiers.find((m) => m.id === el.dataset.g ? false : el.dataset.g);
    // dataset.g guarda el id del modificador directamente en toggleMod? - ajustamos:
  });
  // Recolectar selección desde dataset (guardamos id modificador en data-g)
  document.querySelectorAll('.mod-opt.selected').forEach((el) => {
    const mod = App.data.modifiers.find((m) => m.id === el.dataset.g);
    if (mod) sel.push({ id: mod.id, name: mod.name, delta: +mod.priceDelta });
  });
  const notes = $$('prodNotes')?.value || '';
  const existing = App.cart.find((c) => c.productId === productId && JSON.stringify(c.modifiers) === JSON.stringify(sel) && c.notes === notes);
  if (existing) existing.qty++;
  else App.cart.push({ productId, name: p.name, price: +p.price + sel.reduce((s, m) => s + m.delta, 0), qty: 1, modifiers: sel, notes });
  closeModal();
  Render.command();
  if (navigator.vibrate) navigator.vibrate(30);
}
function cartQty(i, d) {
  App.cart[i].qty += d;
  if (App.cart[i].qty <= 0) App.cart.splice(i, 1);
  Render.command();
}

// Enviar comanda a cocina
function sendOrder() {
  if (!App.cart.length) return toast('El carrito está vacío');
  if (!App.orderId) {
    const items = App.cart.map((c) => ({ productId: c.productId, qty: c.qty, modifiers: c.modifiers.map((m) => m.id), notes: c.notes }));
    App.socket.emit('order:create', { tableId: App.currentTable.id, items, guests: 1 }, (res) => {
      if (res?.ok) {
        App.orderId = res.order.id;
        App.cart = [];
        toast('Comanda enviada a cocina 🍳');
        refreshBootstrap();
        showView('waiter');
      } else toast(res?.error || 'Error');
    });
  } else {
    // Anexar ítems a orden existente
    const items = App.cart.map((c) => ({ productId: c.productId, qty: c.qty, modifiers: c.modifiers.map((m) => m.id), notes: c.notes }));
    App.socket.emit('order:create', { tableId: App.currentTable.id, items, guests: 1 }, (res) => {
      if (res?.ok) { App.orderId = res.order.id; App.cart = []; toast('Anexado a la comanda'); refreshBootstrap(); showView('waiter'); }
    });
  }
}

async function refreshBootstrap() {
  const res = await fetch('/api/bootstrap');
  App.data = await res.json();
}

// Pedir cuenta
function requestBill(orderId) {
  App.socket.emit('order:request-bill', { orderId });
  toast('Cuenta solicitada');
  closeModal();
}
function renderPay(orderId) {
  const o = App.data.orders.find((x) => x.id === orderId);
  if (!o) return;
  openModal(`<div class="modal-box">
    <h3 style="margin-bottom:8px;">Cobrar comanda ${o.id}</h3>
    <div class="muted mono" style="font-size:13px;margin-bottom:12px;">
      Subtotal ${money(o.subtotal)} · Impuesto ${money(o.tax)}<br/>
      Propina <input id="tipInput" class="notes-input" style="width:80px;display:inline-block;padding:4px;" type="number" step="0.05" value="${Math.round(o.tipRate * 100)}"/>
    </div>
    <div class="cart-total" style="font-size:22px;">Total: <span id="payTotal">${money(o.total)}</span></div>
    <div class="mt" style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-success" onclick="doPay('${orderId}','cash')">💵 Efectivo</button>
      <button class="btn btn-primary" onclick="doPay('${orderId}','card')">💳 Tarjeta</button>
      <button class="btn btn-warning" onclick="doPay('${orderId}','qr')">📱 QR</button>
    </div>
  </div>`);
}
function doPay(orderId, method) {
  const tipInput = $$('tipInput');
  const tipRate = tipInput ? (parseFloat(tipInput.value) || 0) / 100 : 0;
  App.socket.emit('order:pay', { orderId, method, tipRate }, (res) => {
    if (res?.ok) {
      toast(`Mesa pagada · ${money(res.order.total)} ${method.toUpperCase()}`);
      closeModal();
      refreshBootstrap().then(() => Render.tables());
    } else toast('Error al cobrar');
  });
}

// Eventos de socket
function onOrderUpdated(o) {
  const idx = App.data.orders.findIndex((x) => x.id === o.id);
  if (idx >= 0) App.data.orders[idx] = o; else App.data.orders.push(o);
  // actualizar mesa si es la actual
  const t = App.data.tables.find((x) => x.id === o.tableId);
  if (t) t.currentOrderId = o.id;
  if (App.user?.role === 'waiter') Render.tables();
  if (App.user?.role === 'admin' || App.user?.role === 'super_admin') { if ($$('view-orders').classList.contains('active')) Render.orders(); }
}
function onOrderClosed(o) {
  App.data.orders = App.data.orders.filter((x) => x.id !== o.id);
  if (App.user?.role === 'waiter') Render.tables();
}
function onTablesUpdated(tables) {
  tables.forEach((nt) => { const t = App.data.tables.find((x) => x.id === nt.id); if (t) Object.assign(t, nt); });
  if (App.user?.role === 'waiter') Render.tables();
}
function onCatalogUpdated(c) {
  const p = App.data.products.find((x) => x.id === c.productId);
  if (p) p.available = c.available;
  if (App.user?.role === 'admin' || App.user?.role === 'super_admin') Render.menu();
}
