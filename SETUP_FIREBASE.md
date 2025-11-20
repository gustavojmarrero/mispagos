# Guía de Configuración de Firebase

Esta guía te ayudará a configurar Firebase para MisPagos paso a paso.

## Parte 1: Crear Proyecto en Firebase Console

### 1. Crear el proyecto

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en "Agregar proyecto"
3. Nombre del proyecto: `mispagos` (o el que prefieras)
4. **Desactiva** Google Analytics (no es necesario para este proyecto)
5. Haz clic en "Crear proyecto"
6. Espera a que se cree el proyecto

### 2. Configurar Authentication

1. En el menú lateral, ve a **Build > Authentication**
2. Haz clic en "Comenzar"
3. Ve a la pestaña **"Sign-in method"**
4. Haz clic en **"Email/Password"**
5. **Activa** el primer switch (Email/Password)
6. Haz clic en "Guardar"

### 3. Crear usuarios

1. Ve a la pestaña **"Users"** en Authentication
2. Haz clic en "Agregar usuario"
3. Crea el primer usuario:
   - Email: `usuario1@mispagos.com`
   - Contraseña: `password123` (cámbiala luego)
4. Repite para crear el segundo usuario:
   - Email: `usuario2@mispagos.com`
   - Contraseña: `password123` (cámbiala luego)

### 4. Configurar Firestore Database

1. En el menú lateral, ve a **Build > Firestore Database**
2. Haz clic en "Crear base de datos"
3. Selecciona **"Comenzar en modo de producción"**
4. Selecciona una ubicación (recomendado: `us-central` o la más cercana)
5. Haz clic en "Habilitar"

### 5. Obtener credenciales de Firebase

1. Haz clic en el ícono de **engranaje** ⚙️ (junto a "Descripción general del proyecto")
2. Selecciona **"Configuración del proyecto"**
3. En la sección **"Tus apps"**, haz clic en el ícono **web** `</>`
4. Registra la app:
   - Sobrenombre de la app: `mispagos-web`
   - **NO** marques Firebase Hosting por ahora
   - Haz clic en "Registrar app"
5. **Copia** el objeto `firebaseConfig` que aparece
6. Guarda estas credenciales temporalmente en un lugar seguro

Ejemplo de lo que deberías copiar:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "mispagos-xxxxx.firebaseapp.com",
  projectId: "mispagos-xxxxx",
  storageBucket: "mispagos-xxxxx.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:xxxxxxxxxxxx"
};
```

## Parte 2: Configurar el Proyecto Local

### 1. Crear archivo de variables de entorno

En la carpeta raíz del proyecto:

```bash
cp .env.example .env.local
```

### 2. Editar .env.local

Abre el archivo `.env.local` y reemplaza los valores con tus credenciales de Firebase:

```env
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=mispagos-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=mispagos-xxxxx
VITE_FIREBASE_STORAGE_BUCKET=mispagos-xxxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:xxxxxxxxxxxx
```

### 3. Instalar Firebase CLI

```bash
npm install -g firebase-tools
```

### 4. Iniciar sesión en Firebase

```bash
firebase login
```

Esto abrirá tu navegador para que autorices Firebase CLI.

### 5. Inicializar Firebase en el proyecto

```bash
firebase init
```

Configuración recomendada:

1. **¿Qué funciones de Firebase quieres configurar?**
   - ✅ Firestore
   - ✅ Hosting

2. **¿Usar un proyecto existente o crear uno nuevo?**
   - → Use an existing project
   - Selecciona el proyecto que creaste

3. **Firestore Rules:**
   - Archivo: `firestore.rules` (ya existe)
   - ¿Sobrescribir? → **No**

4. **Firestore Indexes:**
   - Archivo: `firestore.indexes.json` (ya existe)
   - ¿Sobrescribir? → **No**

5. **Hosting:**
   - ¿Qué usar como directorio público? → `dist`
   - ¿Configurar como SPA? → **Yes**
   - ¿Configurar GitHub Actions? → **No**

### 6. Crear archivo .firebaserc

Si no se creó automáticamente:

```bash
cp .firebaserc.example .firebaserc
```

Edita `.firebaserc` y reemplaza `tu-proyecto-id` con tu Project ID de Firebase.

### 7. Desplegar reglas de Firestore

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

Deberías ver:

```
✔ Deploy complete!
```

## Parte 3: Probar la Aplicación

### 1. Ejecutar en desarrollo

```bash
npm run dev
```

### 2. Abrir en el navegador

Ve a `http://localhost:5173`

### 3. Iniciar sesión

Usa uno de los usuarios que creaste:
- Email: `usuario1@mispagos.com`
- Contraseña: `password123`

### 4. Probar funcionalidades

1. **Agregar una tarjeta:**
   - Ve a "Tarjetas" → "Nueva Tarjeta"
   - Llena los datos de prueba
   - Guarda

2. **Agregar un gasto:**
   - Ve a "Gastos" → "Nuevo Gasto"
   - Selecciona la tarjeta que creaste
   - Llena los datos
   - Guarda

3. **Ver Dashboard:**
   - Verifica que los cálculos se muestren correctamente

## Parte 4: Desplegar a Producción

### 1. Compilar el proyecto

```bash
npm run build
```

### 2. Desplegar a Firebase Hosting

```bash
firebase deploy --only hosting
```

### 3. Acceder a la app

Firebase te dará una URL como:

```
https://mispagos-xxxxx.web.app
```

o

```
https://mispagos-xxxxx.firebaseapp.com
```

## Verificación de Seguridad

### Probar reglas de Firestore

En Firebase Console:

1. Ve a **Firestore Database > Rules**
2. Verifica que las reglas estén desplegadas
3. Ve a **Rules Playground** (pestaña al lado de Rules)
4. Prueba algunas operaciones para verificar que solo usuarios autenticados puedan acceder

## Troubleshooting

### Error: "Firebase not initialized"

- Verifica que `.env.local` existe y tiene las credenciales correctas
- Reinicia el servidor de desarrollo (`npm run dev`)

### Error: "Permission denied" en Firestore

```bash
firebase deploy --only firestore:rules
```

### Error: "Module not found"

```bash
npm install
```

### La app no carga después del deploy

- Verifica que ejecutaste `npm run build` antes de `firebase deploy`
- Verifica que la carpeta `dist/` existe y tiene archivos

## Backup Recomendado

### Exportar datos de Firestore

```bash
# Crear backup
firebase firestore:export backup-$(date +%Y%m%d)
```

### Programar backups automáticos

Puedes usar Cloud Scheduler en Google Cloud Console para programar exports automáticos.

## Recursos Adicionales

- [Documentación de Firebase](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)

## ¿Necesitas Ayuda?

Si encuentras problemas:

1. Revisa la consola del navegador (F12)
2. Revisa los logs de Firebase CLI
3. Verifica que todas las configuraciones estén correctas
4. Asegúrate de que las reglas de Firestore estén desplegadas
