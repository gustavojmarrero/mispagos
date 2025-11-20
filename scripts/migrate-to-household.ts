/**
 * Script de migración: Agregar householdId y campos de auditoría a documentos existentes
 *
 * Ejecutar con: npx tsx scripts/migrate-to-household.ts
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc
} from 'firebase/firestore';

// Configuración de Firebase (copiar de src/lib/firebase.ts)
const firebaseConfig = {
  apiKey: "AIzaSyDi6yAtVNuXZgM3Xze2oPxlhq2eVF_v9-g",
  authDomain: "mispagos-sangus.firebaseapp.com",
  projectId: "mispagos-sangus",
  storageBucket: "mispagos-sangus.firebasestorage.app",
  messagingSenderId: "1029485950031",
  appId: "1:1029485950031:web:75f0c3f3e23a3f5a3b3e3f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

  const querySnapshot = await getDocs(collection(db, collectionName));
  const total = querySnapshot.size;
  let updated = 0;
  let skipped = 0;

  console.log(`   Documentos encontrados: ${total}`);

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
      updates.createdByName = data.userName || 'Usuario'; // Si existe userName
    }

    if (!data.updatedBy && data.userId) {
      updates.updatedBy = data.userId;
      updates.updatedByName = data.userName || 'Usuario';
    }

    // Actualizar documento
    try {
      await updateDoc(doc(db, collectionName, document.id), updates);
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
  console.log('🚀 Iniciando migración a sistema de hogar compartido...\n');
  console.log('Este script agregará los siguientes campos a los documentos:');
  console.log('  - householdId: Identificador del hogar compartido');
  console.log('  - createdBy: ID del usuario que creó el documento');
  console.log('  - createdByName: Nombre del usuario que creó el documento');
  console.log('  - updatedBy: ID del último usuario que modificó el documento');
  console.log('  - updatedByName: Nombre del último usuario que modificó el documento');
  console.log('\n⚠️  IMPORTANTE: Este script modificará los datos en Firestore.');
  console.log('   Asegúrate de tener un backup antes de continuar.\n');

  // Esperar 5 segundos para dar tiempo a cancelar
  console.log('⏳ Iniciando en 5 segundos... (Ctrl+C para cancelar)');
  await new Promise(resolve => setTimeout(resolve, 5000));

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
