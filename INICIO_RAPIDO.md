# 🚀 Inicio Rápido - MisPagos

## Configuración en 5 Minutos

### Paso 1: Crear Proyecto Firebase (2 min)

1. Ve a https://console.firebase.google.com/
2. "Agregar proyecto" → Nombre: `mispagos`
3. Desactiva Google Analytics
4. "Crear proyecto"

### Paso 2: Habilitar Servicios (1 min)

**Authentication:**
- Build > Authentication > Comenzar
- Sign-in method > Email/Password > Activar

**Firestore:**
- Build > Firestore Database > Crear base de datos
- Modo producción > Ubicación: us-central

### Paso 3: Obtener Credenciales (1 min)

1. Configuración del proyecto (⚙️)
2. "Tus apps" > Ícono web `</>`
3. Sobrenombre: `mispagos-web`
4. Copiar `firebaseConfig`

### Paso 4: Configurar Localmente (1 min)

```bash
# 1. Copiar archivo de ejemplo
cp .env.example .env.local

# 2. Editar .env.local con tus credenciales
# (Pegar los valores del firebaseConfig)

# 3. Instalar Firebase CLI (si no lo tienes)
npm install -g firebase-tools

# 4. Login en Firebase
firebase login

# 5. Inicializar Firebase
firebase init
# Seleccionar: Firestore y Hosting
# Proyecto: Elegir el que creaste
# Firestore rules: firestore.rules (No sobrescribir)
# Hosting: dist (Sí a SPA)

# 6. Desplegar reglas
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### Paso 5: Crear Usuarios y Ejecutar

```bash
# Crear usuarios en Firebase Console:
# Authentication > Users > Add user
# - usuario1@mispagos.com / password123
# - usuario2@mispagos.com / password123

# Ejecutar app
npm run dev
```

¡Listo! Abre http://localhost:5173

---

## Comandos Útiles

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Vista previa del build
npm run preview

# Deploy a Firebase
npm run build && firebase deploy --only hosting

# Ver logs de Firebase
firebase firestore:logs
```

## Estructura Mínima .env.local

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=mispagos-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=mispagos-xxxxx
VITE_FIREBASE_STORAGE_BUCKET=mispagos-xxxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:xxxx
```

## Troubleshooting Rápido

**Error: Firebase not initialized**
```bash
# Verifica que .env.local existe y tiene valores correctos
cat .env.local
# Reinicia el servidor
npm run dev
```

**Error: Permission denied**
```bash
# Despliega las reglas de Firestore
firebase deploy --only firestore:rules
```

**Error: Module not found**
```bash
# Reinstala dependencias
rm -rf node_modules
npm install
```

**Build falla**
```bash
# Verifica errores de TypeScript
npx tsc --noEmit
```

---

## Primer Uso

1. **Login**: usa usuario1@mispagos.com
2. **Agregar Tarjeta**:
   - Tarjetas > Nueva Tarjeta
   - Nombre: "BBVA Platino"
   - Últimos 4: "1234"
   - Día corte: 28
   - Día pago: 5
   - Límite: 50000
   - Saldo: 15000

3. **Agregar Gasto**:
   - Gastos > Nuevo Gasto
   - Tarjeta: BBVA Platino
   - Descripción: "Netflix Premium"
   - Monto: 299
   - Día: 15

4. **Ver Dashboard**:
   - Verifica cálculos automáticos
   - Revisa próximos pagos

---

**Para instrucciones detalladas, consulta:**
- `SETUP_FIREBASE.md` - Guía completa de Firebase
- `README.md` - Documentación completa
- `IMPLEMENTACION_COMPLETADA.md` - Resumen de implementación
