# 🍽️ Food-Good

**Sistema Web Responsivo de Comandas para Restaurante**

Aplicación web que digitaliza el ciclo de vida de una comanda —desde la toma en mesa hasta el cobro y análisis— conectando en tiempo real a los tres actores críticos del servicio: **administrador, mozo y cocina**.

> Prototipo funcional basado en la *Especificación Técnica Food-Good v1.0* (Stack objetivo: Next.js 14 · NestJS · PostgreSQL · Socket.IO). Esta implementación usa un stack ligero Node + Express + Socket.IO con persistencia JSON, ejecutable en dispositivos de bajos recursos (Raspberry Pi 5).

---

## ✨ Características

- **Login por PIN** (4 dígitos) con roles: super admin, admin, mozo, cajero, cocina
- **Mapa de mesas** en tiempo real con estados a color (libre, ocupada, en preparación, listo, atención, cuenta, reservada)
- **Toma de comanda** con carrito, modificadores (tamaño, punto de cocción, extras) y notas
- **KDS (Kitchen Display System)** tipo kanban por estación (frío, caliente, parrilla, barra) con cronómetros y cambios de estado en tiempo real
- **Cobro y cierre de mesa**: efectivo, tarjeta o QR, con propina e impuesto
- **Dashboard ejecutivo** con KPIs en vivo (ventas, ticket promedio, mesas cerradas, órdenes activas, ventas por hora, top productos)
- **Gestión de menú**: productos, categorías, precios, estaciones, disponibilidad en vivo
- **Tiempo real** mediante Socket.IO: la cocina y el mozo se sincronizan en menos de un segundo
- Diseño **mobile-first** con paleta y tipografía según especificación (Poppins + Inter, rojo #C0392B)

---

## 🧱 Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js + **Express** |
| Tiempo real | **Socket.IO** |
| Persistencia | JSON file (`data/db.json`) |
| Frontend | HTML/CSS/JS vanilla (SPA), design system propio |
| Estilos | Tailwind-style custom (`css/app.css`) |

---

## 📁 Estructura del proyecto

```
food-good/
├── package.json
├── server/
│   ├── index.js      # Servidor Express + Socket.IO (auth, comandas, KDS, pagos)
│   ├── db.js         # Capa de persistencia JSON (modelo del documento)
│   └── seed.js       # Datos de demostración (mesas, roles, productos)
├── public/
│   ├── index.html    # SPA (login + vistas por rol)
│   ├── css/app.css   # Design system
│   └── js/
│       ├── core.js       # Estado global, helpers, modales, toasts
│       ├── auth.js       # Login PIN, socket, navegación por rol
│       ├── waiter.js     # Módulo mozo: mapa de mesas + comanda + cobro
│       ├── kitchen.js    # Módulo cocina: KDS kanban
│       ├── admin.js      # Módulo admin: órdenes, menú, dashboard KPIs
│       └── app.js        # Arranque: teclado PIN, eventos
├── .gitignore
├── start.sh / stop.sh
└── README.md
```

---

## 🚀 Instalación y ejecución

### Requisitos
- Node.js **18+** (probado con Node 24)
- npm

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/jvaldivia13/Good-Food.git
cd Good-Food

# 2. Instalar dependencias
npm install

# 3. Levantar el servidor
./start.sh
# o bien: npm start
```

El servidor queda en: **http://localhost:3000**
(Por defecto escucha en `0.0.0.0`, así que también es accesible desde la red local.)

### Detener

```bash
./stop.sh
```

---

## 🔑 Pines de acceso (demo)

| Rol | PIN |
|------|-----|
| Super Admin | `1111` |
| Administrador | `2222` |
| Mozo | `3333` |
| Cajero | `4444` |
| Cocina | `5555` |

---

## 🧪 Prueba rápida (tiempo real)

1. Entra con el PIN de **mozo** (`3333`) → toca una mesa libre → *Nueva comanda* → añade productos y modificadores → *Enviar a cocina*.
2. En otra pestaña (o dispositivo) entra con **cocina** (`5555`) → verás el pedido aparecer en el KDS en menos de un segundo.
3. Cambia el estado de los ítems hasta *Listo* → el mozo recibe notificación 🔔.
4. Vuelve al mozo → *Pedir cuenta* → *Cobrar* (efectivo/tarjeta/QR).
5. Con **admin** (`2222`) revisa el dashboard con KPIs y gestiona el menú.

---

## 🔌 API (resumen)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login por PIN. Body: `{"pin":"3333"}` |
| GET | `/api/bootstrap` | Catálogo completo (restaurant, mesas, productos, órdenes) |

Los eventos en tiempo real se exponen por **Socket.IO** de forma automática (`order:create`, `order:send`, `kitchen:item-status`, `order:pay`, `admin:toggle-product`, etc.).

> URL base: `http://localhost:3000`

---

## 🗺️ Hoja de ruta (siguiente fase)

Este prototipo cubre el **MVP funcional** de la especificación. Para llevarlo a producción:

- Migrar persistencia a **PostgreSQL** (esquema Prisma ya definido en el documento)
- Migrar backend a **NestJS** (módulos, guards RBAC, WebSocket Gateways)
- Migrar frontend a **Next.js 14** + Tailwind + shadcn/ui
- Añadir pagos reales (POS/QR), impresión térmica y multi-local
- Implementar modo **offline** con cola de sincronización (PWA)

---

## 📄 Licencia

Proyecto privado de demostración. Documentación de referencia: *Especificación Técnica Food-Good v1.0 (07/08/2026)*.
