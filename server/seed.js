// seed.js — Datos iniciales de demostración (roles, menú, mesas, salones)
const { load, save, next, emptyDb } = require('./db');

function hash(pin) {
  // Prototipo: hash simple. En producción: Argon2id (ver doc). 
  let h = 0;
  for (let i = 0; i < pin.length; i++) h = ((h << 5) - h + pin.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(36);
}

function seed() {
  const db = emptyDb();

  // Salones
  const salonPrincipal = { id: 'area1', name: 'Salón principal', layout: {} };
  const terraza = { id: 'area2', name: 'Terraza', layout: {} };
  const vip = { id: 'area3', name: 'VIP', layout: {} };
  db.diningAreas = [salonPrincipal, terraza, vip];

  // Mesas
  const mkTable = (areaId, number, x, y, capacity) => ({
    id: 't' + next('table'), diningAreaId: areaId, number, capacity,
    status: 'free', x, y
  });
  db.tables = [
    mkTable('area1', 1, 10, 20, 4), mkTable('area1', 2, 10, 45, 2),
    mkTable('area1', 3, 10, 70, 6), mkTable('area1', 4, 40, 20, 4),
    mkTable('area1', 5, 40, 45, 4), mkTable('area1', 6, 40, 70, 4),
    mkTable('area1', 7, 70, 20, 2), mkTable('area1', 8, 70, 45, 6),
    mkTable('area1', 9, 70, 70, 4), mkTable('area1', 10, 95, 45, 8),
    mkTable('area2', 11, 10, 20, 4), mkTable('area2', 12, 10, 45, 2),
    mkTable('area2', 13, 40, 20, 6), mkTable('area2', 14, 40, 45, 4),
    mkTable('area3', 15, 20, 20, 8), mkTable('area3', 16, 20, 55, 6)
  ];

  // Usuarios (PIN de 4 dígitos por rol)
  const mkUser = (name, email, role, pin) => {
    db.users.push({
      id: 'u' + next('user'), restaurantId: 'r1', name, email,
      pin_hash: hash(pin), role, active: true, createdAt: new Date().toISOString()
    });
  };
  mkUser('Owner', 'owner@foodgood.app', 'super_admin', '1111');
  mkUser('Admin', 'admin@foodgood.app', 'admin', '2222');
  mkUser('Mozo', 'mozo@foodgood.app', 'waiter', '3333');
  mkUser('Cajero', 'cajero@foodgood.app', 'cashier', '4444');
  mkUser('Cocina', 'cocina@foodgood.app', 'kitchen', '5555');

  // Categorías
  const mkCat = (name, sort) => ({ id: 'c' + next('category'), restaurantId: 'r1', name, sortOrder: sort, active: true });
  const entradas = mkCat('Entradas', 1);
  const principales = mkCat('Principales', 2);
  const bebidas = mkCat('Bebidas', 3);
  const postres = mkCat('Postres', 4);
  db.categories = [entradas, principales, bebidas, postres];

  // Grupos de modificadores
  const punto = { id: 'mg' + next('modifierGroup'), name: 'Punto de cocción', min: 1, max: 1, required: true };
  const tamaño = { id: 'mg' + next('modifierGroup'), name: 'Tamaño', min: 1, max: 1, required: true };
  const extras = { id: 'mg' + next('modifierGroup'), name: 'Extras', min: 0, max: 3, required: false };
  const mkMod = (gid, name, delta) => ({ id: 'm' + next('modifier'), groupId: gid, name, priceDelta: delta });
  db.modifierGroups = [punto, tamaño, extras];
  db.modifiers = [
    mkMod(punto.id, 'Término', 0), mkMod(punto.id, 'Tres cuartos', 0), mkMod(punto.id, 'Bien hecho', 0),
    mkMod(tamaño.id, 'Normal', 0), mkMod(tamaño.id, 'Grande', 4),
    mkMod(extras.id, 'Extra queso', 2), mkMod(extras.id, 'Extra papas', 2), mkMod(extras.id, 'Bacon', 3)
  ];

  // Productos
  const mkProd = (catId, name, price, cost, station, prepTime, desc) => ({
    id: 'p' + next('product'), categoryId: catId, name, description: desc,
    price: +price, cost: +cost, prepTime, station, available: true,
    allergens: [], imageUrl: ''
  });
  db.products = [
    mkProd(entradas.id, 'Causa limeña', 28, 10, 'cold', 8, 'Puré de papa amarilla con pollo y ají amarillo'),
    mkProd(entradas.id, 'Ceviche clásico', 42, 16, 'cold', 12, 'Pescado fresco, limón, cebolla roja y camote'),
    mkProd(principales.id, 'Lomo saltado', 52, 22, 'hot', 15, 'Tiras de res salteadas con cebolla y tomate'),
    mkProd(principales.id, 'Ají de gallina', 38, 14, 'hot', 12, 'Gallina deshilachada en crema de ají amarillo'),
    mkProd(principales.id, 'Arroz con mariscos', 55, 22, 'hot', 18, 'Arroz cremoso con mariscos y ají'),
    mkProd(principales.id, 'Parrilla mixta', 68, 30, 'grill', 22, 'Filete, pollo y chorizo a la parrilla'),
    mkProd(bebidas.id, 'Chicha morada', 12, 3, 'bar', 2, 'Refresco de maíz morado'),
    mkProd(bebidas.id, 'Pisco sour', 25, 7, 'bar', 3, 'Pisco, limón, clara de huevo y amargo de angostura'),
    mkProd(bebidas.id, 'Limonada frozen', 14, 4, 'bar', 3, 'Limonada helada'),
    mkProd(postres.id, 'Suspiro a la limeña', 18, 6, 'cold', 5, 'Dulce de leche con merengue y canela'),
    mkProd(postres.id, 'Picarones', 15, 5, 'hot', 8, 'Rosquitas de zapallo con miel de chancaca'),
  ];

  save();
  console.log('Seed OK · usuarios:', db.users.map(u => `${u.name}(${u.role})`).join(', '));
  console.log('PINs: super_admin=1111 · admin=2222 · mozo=3333 · cajero=4444 · cocina=5555');
}

if (require.main === module) seed();
module.exports = { seed, hash };
