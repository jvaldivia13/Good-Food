// db.js — Persistencia JSON (modelo de datos del doc: restaurant, user, table, product, order, ...)
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
let db = null;

function emptyDb() {
  db = {
    restaurant: {
      id: 'r1', name: 'Food-Good', address: '', tax_id: '', currency: 'USD',
      timezone: 'America/Lima', config: { taxRate: 0.18, defaultTip: 0.10, languages: ['es'] }
    },
    users: [],
    diningAreas: [],
    tables: [],
    categories: [],
    products: [],
    modifierGroups: [],
    modifiers: [],
    orders: [],
    orderItems: [],
    payments: [],
    notifications: [],
    seq: { user: 100, table: 1, category: 1, product: 1, order: 1, orderItem: 1, modifierGroup: 1, modifier: 1 }
  };
  return db;
}

function load() {
  if (db) return db;
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch (e) {
      console.error('DB corrupta, regenerando seed:', e.message);
      db = null;
    }
  }
  if (!db) {
    emptyDb();
    save();
  }
  return db;
}

function save() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function next(seqName) {
  db.seq[seqName] = (db.seq[seqName] || 0) + 1;
  return db.seq[seqName];
}

module.exports = { load, save, emptyDb, next, getDB: () => db, DB_FILE };
