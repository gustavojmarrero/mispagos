
Total de gastos recurrentes mensuales
Filtros básicos por fecha/tarjeta

Nota sobre la semana: La lógica considera que los pagos se realizan los lunes para cubrir todos los vencimientos hasta el próximo lunes (incluido). Por ejemplo:

Si hoy es miércoles 13: mostrar pagos desde miércoles 13 hasta lunes 18
Si hoy es lunes 11: mostrar pagos desde lunes 11 hasta lunes 18

3.4 Autenticación

Login simple con email/contraseña (Firebase Auth)
2 cuentas predefinidas
No requiere registro público ni recuperación de contraseña compleja

4. Requerimientos No Funcionales
4.1 Simplicidad

Interfaz limpia y directa
Navegación intuitiva
Sin features innecesarias para 2 usuarios

4.2 Seguridad Básica

Autenticación obligatoria
Reglas de Firestore que limiten acceso solo a usuarios autenticados
HTTPS obligatorio

4.3 Responsividad

Funcional en desktop y móvil
Prioridad a uso en desktop

4.4 Datos

Firestore como base de datos
Estructura simple de colecciones:

users (información de usuarios)
cards (tarjetas de crédito)
recurring_expenses (gastos recurrentes)
payments (histórico de pagos - opcional para fase 1)



5. Fuera de Alcance (No Implementar)

Sistema de notificaciones push/email
Integración con bancos o APIs externas
Reportes complejos o gráficas avanzadas
Múltiples usuarios o roles
Sistema de presupuestos
Categorización de gastos no recurrentes
App móvil nativa
Sincronización con Google Sheets
Migración automática desde Google Sheets

6. Flujo de Usuario Principal

Usuario inicia sesión
Ve dashboard con resumen de:

Tarjetas y saldos
Total a pagar esta semana (hasta próximo lunes)
Total pendiente del mes
Próximos pagos
Gastos recurrentes del mes


Puede agregar/editar tarjetas desde sección dedicada
Puede agregar/editar gastos recurrentes
Actualiza montos a pagar conforme realiza pagos

7. Criterios de Éxito

✅ Aplicación funcional y accesible 24/7
✅ Carga rápida (< 3 segundos)
✅ Cero bugs críticos en funcionalidades principales
✅ Usable sin manual de usuario
✅ Cálculos correctos de pagos semanales y mensuales

8. Consideraciones Técnicas
8.1 Firebase

Usar plan Spark (gratuito) inicialmente
Reglas de seguridad restrictivas desde el inicio
Backup manual mensual (export de Firestore)

8.2 UI/UX

Usar librería de componentes ligera (recomendación: shadcn/ui o DaisyUI)
Paleta de colores simple
Indicadores de estado claros (verde/amarillo/rojo para fechas)
Destacar visualmente los montos de la semana vs mes

8.3 Despliegue

Firebase Hosting
CI/CD básico opcional
Variables de entorno para configuración Firebase

9. Fases de Implementación
Fase 1 (MVP)

Autenticación
CRUD de tarjetas
CRUD de gastos recurrentes
Dashboard básico con cálculos semanales y mensuales

Fase 2 (Mejoras)

Filtros y búsqueda
Histórico de pagos
Exportar datos a Excel/CSV

Fase 3 (Opcional)

Gráficas simples
Proyección de gastos

10. Entregables

Aplicación web desplegada en Firebase Hosting
Documentación básica de:

Cómo agregar datos
Cómo hacer backup
Credenciales de acceso para los 2 usuarios




Notas Importantes:

Priorizar funcionalidad sobre estética
Mantener el proyecto simple y mantenible
Evitar over-engineering
Iterar en base a uso real
ReintentarGJ