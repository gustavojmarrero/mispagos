/**
 * Script para verificar los householdId en Firestore
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  projectId: 'mispagos-sangus'
});

const db = getFirestore();

async function checkHouseholds() {
  console.log('🔍 Verificando householdId en todas las colecciones...\n');

  // Verificar usuarios
  console.log('👥 USUARIOS:');
  const users = await db.collection('users').get();
  users.forEach(doc => {
    const data = doc.data();
    console.log(`   ${doc.id} (${data.email}): householdId = ${data.householdId}`);
  });

  // Verificar datos
  const collections = ['cards', 'banks', 'services', 'scheduled_payments'];

  for (const coll of collections) {
    console.log(`\n📦 ${coll.toUpperCase()}:`);
    const snapshot = await db.collection(coll).get();

    if (snapshot.empty) {
      console.log('   (vacía)');
      continue;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   ${doc.id}: householdId = ${data.householdId}, userId = ${data.userId}`);
    });
  }
}

checkHouseholds()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
