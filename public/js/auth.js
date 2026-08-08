// auth.js — Login por PIN, bootstrap y entrada por rol
async function doLogin(pin) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    $$('loginError').textContent = 'PIN inválido. Intenta de nuevo.';
    return;
  }
  const { user } = await res.json();
  App.user = user;
  await startApp();
}

async function startApp() {
  const res = await fetch('/api/bootstrap');
  App.data = await res.json();

  // Conectar socket con identidad
  App.socket = io({ auth: { userId: App.user.id } });
  App.socket.on('order:updated', (o) => onOrderUpdated(o));
  App.socket.on('order:closed', (o) => onOrderClosed(o));
  App.socket.on('table:updated', (tables) => onTablesUpdated(tables));
  App.socket.on('catalog:updated', (c) => onCatalogUpdated(c));
  App.socket.on('catalog:reload', async () => {
    const r = await fetch('/api/bootstrap');
    App.data = await r.json();
    Render.menu();
  });
  App.socket.on('notification:new', (n) => { if (n.userId === App.user.id && App.user.role === 'waiter') toast('🔔 ' + (n.payload?.count || '') + ' ítem(s) listos para servir'); });

  $$('loginView').classList.add('hidden');
  $$('appView').classList.remove('hidden');
  $$('roleChip').textContent = roleLabel(App.user.role);
  buildNav();
  // Vista inicial según rol
  const initial = { waiter: 'waiter', kitchen: 'kitchen', cashier: 'orders', admin: 'dashboard', super_admin: 'dashboard' }[App.user.role] || 'waiter';
  showView(initial);
  setInterval(() => { if (App.user && App.user.role === 'kitchen') Render.kitchen(); }, 5000);
  setInterval(() => { if (App.user && ['admin', 'super_admin'].includes(App.user.role)) Render.dashboard(); }, 10000);
}

function buildNav() {
  const nav = $$('bottomNav');
  nav.innerHTML = '';
  const items = [];
  if (App.user.role === 'waiter') {
    items.push({ id: 'waiter', label: 'Mesas', ic: '🍽️' });
    items.push({ id: 'command', label: 'Comanda', ic: '🧾' });
  } else if (App.user.role === 'kitchen') {
    items.push({ id: 'kitchen', label: 'KDS', ic: '👨‍🍳' });
  } else if (App.user.role === 'cashier') {
    items.push({ id: 'orders', label: 'Órdenes', ic: '💳' });
  } else { // admin / super_admin
    items.push({ id: 'dashboard', label: 'Panel', ic: '📊' });
    items.push({ id: 'waiter', label: 'Mesas', ic: '🍽️' });
    items.push({ id: 'orders', label: 'Órdenes', ic: '💳' });
    items.push({ id: 'menu', label: 'Menú', ic: '📖' });
  }
  items.forEach((it) => {
    const b = document.createElement('button');
    b.dataset.view = it.id;
    b.innerHTML = `<span class="ic">${it.ic}</span>${it.label}`;
    b.onclick = () => showView(it.id);
    nav.appendChild(b);
  });
}

const VIEW_NAMES = { waiter: 'Mesas', command: 'Comanda', kitchen: 'Cocina (KDS)', orders: 'Órdenes', menu: 'Menú', dashboard: 'Panel' };
function showView(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  $$('view-' + id).classList.add('active');
  document.querySelectorAll('#bottomNav button').forEach((b) => b.classList.toggle('active', b.dataset.view === id));
  const top = $$('topbarAction');
  if (id === 'waiter' && ['waiter', 'admin', 'super_admin'].includes(App.user.role)) { top.textContent = 'Crear comanda'; top.classList.remove('hidden'); top.onclick = () => renderTablePicker(); }
  else if (id === 'command') { top.textContent = 'Enviar a cocina'; top.classList.remove('hidden'); top.onclick = sendOrder; }
  else if (id === 'menu') { top.textContent = '+ Producto'; top.classList.remove('hidden'); top.onclick = () => Render.productForm(); }
  else top.classList.add('hidden');
  const renderers = { waiter: Render.tables, kitchen: Render.kitchen, orders: Render.orders, menu: Render.menu, dashboard: Render.dashboard, command: Render.command };
  if (renderers[id]) renderers[id]();
}
