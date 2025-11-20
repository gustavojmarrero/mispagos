/**
 * Script para agregar el usuario de Sandra con el householdId correcto
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

initializeApp({
  projectId: 'mispagos-sangus'
});

const db = getFirestore();
const auth = getAuth();

async function addSandraUser() {
  console.log('👥 Buscando usuario Sandy en Firebase Auth...\n');

  // Buscar el usuario por email
  let sandraUid: string;
  try {
    const userRecord = await auth.getUserByEmail('sandy.cado@gmail.com');
    sandraUid = userRecord.uid;
    console.log(`✅ Usuario encontrado: ${userRecord.email} (uid: ${sandraUid})`);
  } catch (error) {
    console.error('❌ Usuario no encontrado en Firebase Auth');
    console.log('\n💡 Necesitas que Sandy inicie sesión primero para crear su cuenta en Firebase Auth.');
    process.exit(1);
  }

  // El householdId de Gustavo
  const gustavoHouseholdId = 'gUusriTKfkSvb2Ss9lhNQ5qbztG3';

  // Crear documento de usuario
  console.log(`\n📝 Creando documento de usuario para Sandy...`);
  console.log(`   householdId: ${gustavoHouseholdId} (mismo que Gustavo)`);

  const userDoc = {
    email: 'sandy.cado@gmail.com',
    name: 'Sandra',
    householdId: gustavoHouseholdId, // Usar el mismo householdId de Gustavo
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection('users').doc(sandraUid).set(userDoc);

  console.log('✅ Documento de usuario creado exitosamente!');
  console.log('\n🎉 Ahora Sandy y Gustavo comparten el mismo householdId.');
  console.log('   Ambos pueden ver y editar los mismos datos.');
}

addSandraUser()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
