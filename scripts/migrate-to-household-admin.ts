/**
 * Script de migración usando Firebase Admin SDK (con permisos elevados)
 *
 * Ejecutar con: npx tsx scripts/migrate-to-household-admin.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Inicializar Firebase Admin SDK
// NOTA: Este script usa credenciales de aplicación por defecto de Google Cloud
// Si falla, necesitarás configurar una service account key
try {
  initializeApp({
    projectId: 'mispagos-sangus'
  });
} catch (error) {
  console.error('Error inicializando Firebase Admin:', error);
  console.log('\n⚠️  Para usar este script, necesitas:');
  console.log('   1. Tener gcloud CLI instalado y autenticado');
  console.log('   2. O configurar GOOGLE_APPLICATION_CREDENTIALS con una service account key');
  process.exit(1);
}

const db = getFirestore();

const collections = [
  'users',
  'cards',
  'banks',
  'services',
  'scheduled_payments',
  'payment_instances',
  'payment_history',
  'recurring_expenses',
  'payments'
];

async function migrateCollection(collectionName: string) {
  console.log(`\n🔄 Migrando colección: ${collectionName}`);

  const querySnapshot = await db.collection(collectionName).get();
  const total = querySnapshot.size;
  let updated = 0;
  let skipped = 0;

  console.log(`   Documentos encontrados: ${total}`);

  if (total === 0) {
    console.log(`   ℹ️  Colección vacía, saltando...`);
    return;
  }

  for (const document of querySnapshot.docs) {
    const data = document.data();

    // Verificar si ya tiene householdId
    if (data.householdId) {
      skipped++;
      continue;
    }

    // Preparar actualización
    const updates: any = {};

    // Para la colección users
    if (collectionName === 'users') {
      updates.householdId = document.id; // El householdId es el mismo que el userId
      console.log(`   📝 Usuario ${document.id}: householdId = ${updates.householdId}`);
    } else {
      // Para otras colecciones, usar el userId existente
      if (data.userId) {
        updates.householdId = data.userId;
      } else {
        console.warn(`   ⚠️  Documento ${document.id} no tiene userId, saltando...`);
        skipped++;
        continue;
      }
    }

    // Agregar campos de auditoría si no existen
    if (!data.createdBy && data.userId) {
      updates.createdBy = data.userId;
      updates.createdByName = data.name || 'Usuario';
    }

    if (!data.updatedBy && data.userId) {
      updates.updatedBy = data.userId;
      updates.updatedByName = data.name || 'Usuario';
    }

    // Actualizar documento
    try {
      await db.collection(collectionName).doc(document.id).update(updates);
      updated++;

      if (updated % 10 === 0) {
        console.log(`   Progreso: ${updated}/${total} documentos actualizados`);
      }
    } catch (error) {
      console.error(`   ❌ Error actualizando documento ${document.id}:`, error);
    }
  }

  console.log(`   ✅ Completado: ${updated} actualizados, ${skipped} saltados`);
}

async function main() {
  console.log('🚀 Iniciando migración a sistema de hogar compartido (Admin SDK)...\n');
  console.log('Este script agregará los siguientes campos a los documentos:');
  console.log('  - householdId: Identificador del hogar compartido');
  console.log('  - createdBy: ID del usuario que creó el documento');
  console.log('  - createdByName: Nombre del usuario que creó el documento');
  console.log('  - updatedBy: ID del último usuario que modificó el documento');
  console.log('  - updatedByName: Nombre del último usuario que modificó el documento');
  console.log('\n⚠️  IMPORTANTE: Este script modificará los datos en Firestore.');
  console.log('   Usando Firebase Admin SDK con permisos elevados.\n');

  // Esperar 3 segundos para dar tiempo a cancelar
  console.log('⏳ Iniciando en 3 segundos... (Ctrl+C para cancelar)');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Migrar cada colección
  for (const collectionName of collections) {
    try {
      await migrateCollection(collectionName);
    } catch (error) {
      console.error(`❌ Error al migrar colección ${collectionName}:`, error);
    }
  }

  console.log('\n\n✨ Migración completada!');
  console.log('\n📝 Próximos pasos:');
  console.log('   1. Verifica que los datos se vean correctamente en la aplicación');
  console.log('   2. Para compartir datos entre usuarios:');
  console.log('      - Ve a Firebase Console');
  console.log('      - Actualiza el campo householdId de ambos usuarios al mismo valor');
  console.log('      - Todos los documentos de esos usuarios se compartirán automáticamente');

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
