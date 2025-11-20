# MisPagos - Gestión de Pagos Recurrentes

Aplicación web para gestionar pagos recurrentes de tarjetas de crédito.

## Características

- ✅ Gestión de tarjetas de crédito
- ✅ Gestión de gastos recurrentes
- ✅ Dashboard con cálculos automáticos
- ✅ Cálculo de pagos semanales (hasta próximo lunes)
- ✅ Cálculo de gastos mensuales
- ✅ Autenticación con Firebase
- ✅ Responsive design
- ✅ Interfaz en español

## Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui
- **Backend**: Firebase (Auth + Firestore)
- **Hosting**: Firebase Hosting

## Requisitos Previos

- Node.js 18+ y npm
- Cuenta de Firebase
- Git

## Instalación

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd mispagos
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar Firebase

#### a) Crear proyecto en Firebase Console

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto llamado "mispagos" (o el nombre que prefieras)
3. Habilita **Firebase Authentication**:
   - Ve a Authentication > Sign-in method
   - Habilita "Email/Password"
4. Habilita **Cloud Firestore**:
   - Ve a Firestore Database
   - Crea una base de datos en modo "production"
   - Selecciona la ubicación más cercana

#### b) Obtener credenciales

1. Ve a Project Settings (ícono de engranaje)
2. En la sección "Your apps", haz clic en el ícono web (</>)
3. Registra la app con el nombre "mispagos-web"
4. Copia las credenciales del `firebaseConfig`

#### c) Configurar variables de entorno

1. Copia el archivo de ejemplo:

```bash
cp .env.example .env.local
```

2. Edita `.env.local` y agrega tus credenciales de Firebase:

```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_proyecto_id
VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

### 4. Configurar Firebase CLI

```bash
# Instalar Firebase CLI globalmente
npm install -g firebase-tools

# Iniciar sesión en Firebase
firebase login

# Inicializar proyecto (si no está inicializado)
firebase init

# Seleccionar:
# - Firestore
# - Hosting
# Elegir el proyecto que creaste en Firebase Console
```

### 5. Desplegar reglas de Firestore

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 6. Crear usuarios

Ve a Firebase Console > Authentication > Users y crea 2 usuarios manualmente con email y contraseña:

Ejemplo:
- usuario1@mispagos.com / contraseña123
- usuario2@mispagos.com / contraseña123

## Desarrollo

Ejecutar servidor de desarrollo:

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## Build y Despliegue

### Build local

```bash
npm run build
```

### Desplegar a Firebase Hosting

```bash
# Build y deploy en un solo comando
npm run build && firebase deploy --only hosting
```

La app estará disponible en: `https://tu-proyecto.web.app`

## Estructura del Proyecto

```
mispagos/
├── src/
│   ├── components/
│   │   ├── ui/              # Componentes shadcn/ui
│   │   ├── auth/            # Componentes de autenticación
│   │   └── layout/          # Layout principal
│   ├── contexts/
│   │   └── AuthContext.tsx  # Contexto de autenticación
│   ├── lib/
│   │   ├── firebase.ts      # Configuración Firebase
│   │   ├── types.ts         # Tipos TypeScript
│   │   └── utils.ts         # Funciones utilitarias
│   ├── pages/
│   │   ├── Dashboard.tsx    # Dashboard principal
│   │   ├── Cards.tsx        # CRUD de tarjetas
│   │   └── Expenses.tsx     # CRUD de gastos
│   ├── App.tsx              # Componente principal
│   ├── main.tsx             # Punto de entrada
│   └── index.css            # Estilos globales
├── firestore.rules          # Reglas de seguridad
├── firestore.indexes.json   # Índices de Firestore
├── firebase.json            # Configuración Firebase
└── package.json
```

## Uso

### 1. Iniciar sesión

Usa uno de los usuarios que creaste en Firebase Auth.

### 2. Agregar tarjetas

1. Ve a la sección "Tarjetas"
2. Haz clic en "Nueva Tarjeta"
3. Llena los datos:
   - Nombre (ej: "BBVA Platino")
   - Últimos 4 dígitos
   - Día de corte (1-31)
   - Día de pago (1-31)
   - Límite de crédito
   - Saldo actual

### 3. Agregar gastos recurrentes

1. Ve a la sección "Gastos"
2. Haz clic en "Nuevo Gasto"
3. Llena los datos:
   - Selecciona una tarjeta
   - Descripción (ej: "Netflix Premium")
   - Monto
   - Día de vencimiento (1-31)

### 4. Ver dashboard

El dashboard muestra:
- Total a pagar esta semana (hasta próximo lunes)
- Total mensual de gastos recurrentes
- Número de tarjetas activas
- Número de gastos activos
- Próximos 5 pagos con indicadores de estado
- Resumen de tarjetas con saldos

## Backup de Datos

### Exportar datos de Firestore

```bash
# Usando Firebase CLI
firebase firestore:export backup-$(date +%Y%m%d)

# O manualmente desde Firebase Console:
# Firestore Database > Import/Export
```

## Seguridad

- ✅ Autenticación obligatoria
- ✅ Reglas de Firestore que limitan acceso solo a datos del usuario autenticado
- ✅ HTTPS obligatorio en producción
- ✅ Variables de entorno para credenciales

## Troubleshooting

### Error: Firebase not initialized

Verifica que el archivo `.env.local` existe y tiene las credenciales correctas.

### Error: Permission denied

Verifica que las reglas de Firestore están desplegadas:

```bash
firebase deploy --only firestore:rules
```

### La app no carga en producción

Verifica que el build se completó correctamente y que los archivos están en la carpeta `dist/`.

## Fases Futuras

### Fase 2 (Planeada)
- [ ] Filtros por fecha/tarjeta
- [ ] Histórico de pagos
- [ ] Exportar datos a Excel/CSV
- [ ] Marcar pagos como realizados

### Fase 3 (Opcional)
- [ ] Gráficas simples
- [ ] Proyección de gastos
- [ ] Dark mode

## Licencia

Uso privado - 2 usuarios
