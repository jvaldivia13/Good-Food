// index.js — Servidor Food-Good (Express + Socket.IO + persistencia JSON)
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { load, save, next, getDB, DB_FILE } = require('./db');

const PORT = process.env.PORT || 3000;
const db = load();

const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ---------- Utilidades ----------
const hash = (s) => { let h = 0; for (let i = 0; i < String(s).length; i++) h = ((h << 5) - h + String(s).charCodeAt(i)) | 0; return 'h' + (h >>> 0).toString(36); };
const uid = (p) => p + next(p === 'u' ? 'user' : p);
const now = () => new Date().toISOString();
const byId = (arr, id) => arr.find((x) => x.id === id);
const totalOrder = (o) => ({ subtotal: o.subtotal, tax: o.tax, tip: o.tip, discount: o.discount, total: o.total });
const money = (n) => (n == null ? 0 : Math.round(n * 100) / 100);

function computeOrder(o) {
  let subtotal = 0;
  for (const it of db.orderItems.filter((i) => i.orderId === o.id)) subtotal += it.unitPrice * it.qty;
  const discount = +(o.discount || 0);
  const taxRate = db.restaurant.config.taxRate || 0;
  const tax = money((subtotal - discount) * taxRate);
  const tip = money((subtotal - discount) * (o.tipRate || 0));
  o.subtotal = money(subtotal);
  o.tax = tax; o.tip = tip;
  o.total = money(subtotal - discount + tax + tip);
  return o;
}

// ---------- Estado de mesa derivado de la orden activa ----------
const TABLE_STATUS_ORDER = ['free', 'occupied', 'preparing', 'ready', 'attention', 'bill', 'reserved'];
function refreshTableStatus() {
  for (const t of db.tables) {
    const active = db.orders.find((o) => o.tableId === t.id && ['open', 'preparing', 'ready', 'bill'].includes(o.status));
    if (!active) { t.status = 'free'; continue; }
    if (active.status === 'bill') t.status = 'bill';
    else if (active.status === 'ready') t.status = 'ready';
    else if (active.status === 'preparing') t.status = 'preparing';
    else t.status = 'occupied';
    t.currentOrderId = active.id;
  }
  save();
}

// ---------- Notificaciones en tiempo real ----------
function emitAll(event, payload) { io.emit(event, payload); }
function persistNotification(userId, type, payload) {
  db.notifications.push({ id: 'n' + next('notification'), userId, type, payload, readAt: null, at: now() });
  if (db.notifications.length > 200) db.notifications.splice(0, db.notifications.length - 200);
  save();
  io.emit('notification:new', db.notifications[db.notifications.length - 1]);
}

// ---------- API REST ----------
// Auth: login por PIN
app.post('/api/auth/login', (req, res) => {
  const { pin } = req.body;
  const user = db.users.find((u) => u.active && u.pin_hash === hash(pin && String(pin).trim()));
  if (!user) return res.status(401).json({ error: 'PIN inválido' });
  return res.json({ user: { id: user.id, name: user.name, role: user.role } });
});

// Catálogo (público con token implícito por sesión de socket; aquí servimos sin auth para demo)
app.get('/api/bootstrap', (req, res) => {
  return res.json({
    restaurant: db.restaurant,
    tables: db.tables.map((t) => ({ id: t.id, number: t.number, capacity: t.capacity, status: t.status, diningAreaId: t.diningAreaId, x: t.x, y: t.y, currentOrderId: t.currentOrderId })),
    diningAreas: db.diningAreas,
    categories: db.categories,
    products: db.products,
    modifierGroups: db.modifierGroups,
    modifiers: db.modifiers,
    orders: db.orders.map((o) => ({ ...o, items: db.orderItems.filter((i) => i.orderId === o.id) }))
  });
});

// ---------- Sockets ----------
io.on('connection', (socket) => {
  socket.emit('hello', { ok: true });

  // Leer estado de una orden
  socket.on('order:get', (orderId, cb) => {
    cb && cb(byId(db.orders, orderId) || null);
  });

  // Tomar comanda: el mozo agrega ítems a una orden
  socket.on('order:create', ({ tableId, items, guests = 1 }, cb) => {
    const t = byId(db.tables, tableId);
    if (!t) return cb && cb({ error: 'Mesa no existe' });
    let order = db.orders.find((o) => o.tableId === tableId && ['open', 'preparing', 'ready', 'bill'].includes(o.status));
    if (!order) {
      order = { id: 'o' + next('order'), tableId, waiterId: socket.handshake.auth.userId, guests, status: 'open', openedAt: now(), closedAt: null, subtotal: 0, tax: 0, tip: 0, tipRate: 0, discount: 0, total: 0 };
      db.orders.push(order);
    } else {
      order.guests = guests;
      order.openedAt = order.openedAt || now();
    }
    for (const item of items) {
      const prod = byId(db.products, item.productId);
      if (!prod) continue;
      db.orderItems.push({
        id: 'oi' + next('orderItem'), orderId: order.id, productId: prod.id,
        productName: prod.name, qty: item.qty, unitPrice: +prod.price + (+item.priceDelta || 0),
        status: 'new', station: prod.station, notes: item.notes || '',
        modifiersJson: item.modifiers || [], sentAt: now(), readyAt: null, servedAt: null
      });
    }
    computeOrder(order);
    refreshTableStatus();
    save();
    notifyAll(order);
    cb && cb({ ok: true, order });
  });

  // Enviar comanda a cocina
  socket.on('order:send', ({ orderId }, cb) => {
    const o = byId(db.orders, orderId);
    if (!o) return cb && cb({ error: 'no order' });
    o.status = 'preparing';
    for (const it of db.orderItems.filter((i) => i.orderId === orderId && i.status === 'new')) it.status = 'sent';
    computeOrder(o); refreshTableStatus(); save();
    emitAll('order:updated', serializeOrder(o));
    cb && cb({ ok: true, order: serializeOrder(o) });
  });

  // Estado de ítem en cocina
  socket.on('kitchen:item-status', ({ orderId, itemId, status }) => {
    const it = byId(db.orderItems, itemId);
    const o = byId(db.orders, orderId);
    if (!it || !o) return;
    it.status = status;
    if (status === 'ready') it.readyAt = now();
    const remaining = db.orderItems.filter((i) => i.orderId === orderId && ['new', 'sent', 'preparing'].includes(i.status));
    if (remaining.length === 0 && status === 'ready') o.status = 'ready';
    computeOrder(o); refreshTableStatus(); save();
    const payload = serializeOrder(o);
    emitAll('order:updated', payload);
    // Notificar al mozo que algo está listo
    const readyItems = db.orderItems.filter((i) => i.orderId === orderId && i.status === 'ready');
    if (readyItems.length) persistNotification(o.waiterId, 'items_ready', { orderId, count: readyItems.length, tableNumber: byId(db.tables, o.tableId)?.number });
  });

  // Marcar ítem servido por el mozo
  socket.on('order:item-served', ({ orderId, itemId }) => {
    const it = byId(db.orderItems, itemId);
    if (it) it.status = 'served'; it.servedAt = now();
    const o = byId(db.orders, orderId);
    const active = db.orderItems.filter((i) => i.orderId === orderId && ['new', 'sent', 'preparing', 'ready'].includes(i.status));
    if (active.length === 0 && o) { o.status = 'occupied'; }
    if (o) { computeOrder(o); refreshTableStatus(); save(); emitAll('order:updated', serializeOrder(o)); }
  });

  // Pedir cuenta
  socket.on('order:request-bill', ({ orderId }) => {
    const o = byId(db.orders, orderId); if (!o) return;
    o.status = 'bill'; save(); refreshTableStatus();
    emitAll('order:updated', serializeOrder(o));
  });

  // Pagar y cerrar mesa
  socket.on('order:pay', ({ orderId, method = 'cash', tipRate = 0 }, cb) => {
    const o = byId(db.orders, orderId); if (!o) return cb && cb({ error: 'no order' });
    o.tipRate = tipRate; computeOrder(o);
    db.payments.push({ id: 'pay' + next('payment'), orderId, method, amount: o.total, tip: o.tip, ref: 'REF-' + Date.now() % 1000000, processedAt: now(), cashierId: socket.handshake.auth.userId });
    o.status = 'closed'; o.closedAt = now();
    refreshTableStatus(); save();
    emitAll('order:closed', serializeOrder(o));
    emitAll('table:updated', db.tables.map((t) => ({ id: t.id, status: t.status, currentOrderId: t.currentOrderId, number: t.number })));
    cb && cb({ ok: true, order: serializeOrder(o) });
  });

  // Admin: activar/desactivar producto
  socket.on('admin:toggle-product', ({ productId }) => {
    const p = byId(db.products, productId); if (!p) return;
    p.available = !p.available; save();
    emitAll('catalog:updated', { productId, available: p.available });
  });

  // Admin: marcar mesa pendiente de atención
  socket.on('table:attention', ({ tableId, on }) => {
    const t = byId(db.tables, tableId); if (!t) return;
    if (t.status === 'free') return;
    t.status = on ? 'attention' : (t.status === 'attention' ? 'occupied' : t.status);
    save(); emitAll('table:updated', db.tables.map((x) => ({ id: x.id, status: x.status, currentOrderId: x.currentOrderId, number: x.number })));
  });

  // Admin: crear/editar producto
  socket.on('admin:save-product', (data, cb) => {
    if (data.id) {
      const p = byId(db.products, data.id); if (!p) return cb && cb({ error: 'no product' });
      Object.assign(p, { name: data.name, price: +data.price, cost: +data.cost, description: data.description, categoryId: data.categoryId, station: data.station, prepTime: +data.prepTime });
    } else {
      db.products.push({ id: 'p' + next('product'), categoryId: data.categoryId, name: data.name, description: data.description, price: +data.price, cost: +data.cost, prepTime: +data.prepTime, station: data.station, available: true, allergens: [], imageUrl: '' });
    }
    save(); emitAll('catalog:reload', { products: db.products });
    cb && cb({ ok: true });
  });
});

function serializeOrder(o) {
  return { ...o, items: db.orderItems.filter((i) => i.orderId === o.id) };
}
function notifyAll(order) {
  emitAll('order:updated', serializeOrder(order));
  emitAll('table:updated', db.tables.map((t) => ({ id: t.id, status: t.status, currentOrderId: t.currentOrderId, number: t.number })));
}

// ---------- Static frontend ----------
app.use(express.static(path.join(__dirname, '..', 'public')));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🧑‍🍳 Food-Good corriendo en http://0.0.0.0:${PORT}`);
  console.log(`   Accede desde tu navegador en la Pi o en http://192.168.18.13:${PORT} (red local)`);
  console.log(`   PINs: admin=2222 · mozo=3333 · cajero=4444 · cocina=5555 · owner=1111\n`);
});
