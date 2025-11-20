# Changelog

## [0.1.0] - 2024-11-18

### Fase 1 - MVP Completado

#### ✅ Features Implementadas

- **Autenticación**
  - Login con Email/Password usando Firebase Auth
  - Protección de rutas privadas
  - Contexto de autenticación global
  - Persistencia de sesión

- **Gestión de Tarjetas (CRUD)**
  - Crear tarjetas de crédito
  - Editar información de tarjetas
  - Eliminar tarjetas
  - Visualización de saldos y límites
  - Indicador visual de utilización

- **Gestión de Gastos Recurrentes (CRUD)**
  - Crear gastos recurrentes
  - Editar gastos
  - Eliminar gastos
  - Activar/Desactivar gastos
  - Asociación con tarjetas

- **Dashboard**
  - Total a pagar esta semana (hasta próximo lunes)
  - Total mensual de gastos recurrentes
  - Próximos 5 pagos con indicadores de estado (vencido, próximo, distante)
  - Resumen de tarjetas con saldos
  - Estadísticas generales

- **UI/UX**
  - Diseño responsive (mobile y desktop)
  - Componentes reutilizables con shadcn/ui
  - Navegación intuitiva
  - Indicadores visuales de estado
  - Formularios con validación

- **Seguridad**
  - Reglas de Firestore que limitan acceso por usuario
  - HTTPS obligatorio en producción
  - Variables de entorno para credenciales
  - Autenticación obligatoria

#### 🔧 Configuración

- Estructura de proyecto con Vite + React + TypeScript
- Firebase (Auth, Firestore, Hosting)
- Tailwind CSS + shadcn/ui
- ESLint configurado
- Firestore indexes

#### 📚 Documentación

- README completo
- Guía de configuración de Firebase paso a paso
- Estructura de datos documentada
- Tipos TypeScript definidos

### Próximas Fases

#### Fase 2 (Planificada)
- [ ] Filtros por fecha/tarjeta
- [ ] Histórico de pagos
- [ ] Búsqueda de gastos
- [ ] Exportar datos a Excel/CSV
- [ ] Marcar pagos como realizados

#### Fase 3 (Opcional)
- [ ] Gráficas simples (gastos por tarjeta)
- [ ] Proyección de gastos futuros
- [ ] Dark mode
- [ ] Notificaciones de vencimientos próximos
