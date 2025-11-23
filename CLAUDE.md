# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

**MisPagos** - Aplicación web de gestión de pagos de tarjetas de crédito y servicios recurrentes. SPA construida con React + TypeScript, desplegada en Firebase Hosting con Firestore como base de datos.

## Comandos de Desarrollo

```bash
npm run dev        # Servidor de desarrollo (localhost:5173)
npm run build      # TypeScript check + build de producción
npm run lint       # ESLint (máximo 0 warnings)
npm run preview    # Preview del build

# Firebase deployment
firebase deploy --only hosting
firebase deploy --only firestore:rules
```

## Stack Tecnológico

- **Frontend:** React 18 + TypeScript + Vite
- **Routing:** React Router DOM 6
- **Styling:** Tailwind CSS + shadcn/ui (componentes Radix UI)
- **Backend:** Firebase (Auth + Firestore)
- **Forms:** React Hook Form + Zod (validación)
- **Animaciones:** Framer Motion
- **Utilidades:** date-fns (localización es-MX), Lucide React (iconos), Sonner (toasts)

**Alias de importación:** `@/` → `/src`

## Arquitectura

### Estructura de Directorios

```
/src
├── components/         # Componentes React reutilizables
│   ├── ui/            # Componentes base shadcn/ui
│   └── [feature]/     # Componentes por feature (auth, cards, dashboard, reports, layout)
├── contexts/          # AuthContext (autenticación global)
├── hooks/             # Hooks personalizados (useBanks, useServices)
├── lib/               # Lógica de negocio, tipos y utilidades
│   ├── types.ts       # Definiciones TypeScript principales
│   ├── firebase.ts    # Inicialización Firebase
│   ├── dashboardMetrics.ts  # Cálculos del dashboard
│   ├── reportsMetrics.ts    # Métricas de reportes
│   └── paymentInstances.ts  # Lógica de instancias de pago
├── pages/             # Páginas principales (Dashboard, Cards, Payments, etc.)
└── utils/             # Animaciones y contexto de períodos
```

### Modelo de Datos Firestore

**Colecciones principales:**

- `users` - Información de usuario con `householdId` para hogares compartidos
- `cards` - Tarjetas de crédito (closingDay, dueDay, creditLimit, owner, bankId)
- `banks` - Instituciones bancarias
- `services` - Servicios recurrentes (paymentMethod: card|transfer)
- `scheduled_payments` - Plantillas de pagos recurrentes (frequency: monthly|weekly|once)
- `payment_instances` - Instancias específicas de pagos con soporte para pagos parciales
- `payment_history` - Histórico de transacciones

**Patrón de acceso:** Acceso controlado por `householdId` (multi-usuario) con compatibilidad hacia atrás con `userId`.

### Rutas

```
/login     - Autenticación
/          - Dashboard principal
/cards     - CRUD tarjetas (vista grid/lista)
/payments  - Pagos programados
/calendar  - Calendario interactivo
/reports   - Análisis y reportes
/services  - Gestión de servicios
/banks     - Gestión de bancos
```

## Patrones de Código

### State Management
- React Context para autenticación (`AuthContext`)
- `useState` para estado local de componentes
- Firestore como fuente de verdad (queries reactivas)

### Formularios
- React Hook Form + Zod para validación
- Schemas Zod definidos junto a formularios (buscar `z.object()`)

### Lógica de Negocio
- **Período "Esta semana":** Desde hoy hasta el próximo lunes (inclusive)
- **Instancias de pago:** Pagos recurrentes generan instancias específicas con estado (pending|partial|paid|overdue|cancelled)
- **Pagos parciales:** Soporte completo con array `partialPayments[]`

## Archivos Clave para Contexto

- `/src/lib/types.ts` - Todas las interfaces TypeScript
- `/src/lib/dashboardMetrics.ts` - Lógica de cálculos complejos
- `/src/pages/Dashboard.tsx` - Flujo principal de la app
- `firestore.rules` - Reglas de seguridad Firestore

## Configuración Firebase

- Proyecto: `mispagos-sangus`
- Variables de entorno: `VITE_FIREBASE_*` en `.env.local`
- Hosting: carpeta `dist`
- Rewrite SPA: todas las rutas → `index.html`
