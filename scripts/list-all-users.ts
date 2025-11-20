/**
 * Script para listar todos los usuarios en Firebase Auth
 */

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

initializeApp({
  projectId: 'mispagos-sangus'
});

const auth = getAuth();

async function listAllUsers() {
  console.log('👥 Listando todos los usuarios en Firebase Auth...\n');

  const listUsersResult = await auth.listUsers();

  if (listUsersResult.users.length === 0) {
    console.log('❌ No hay usuarios en Firebase Auth');
    return;
  }

  console.log(`Encontrados ${listUsersResult.users.length} usuario(s):\n`);

  listUsersResult.users.forEach((userRecord, index) => {
    console.log(`${index + 1}. Email: ${userRecord.email}`);
    console.log(`   UID: ${userRecord.uid}`);
    console.log(`   Display Name: ${userRecord.displayName || '(ninguno)'}`);
    console.log(`   Email Verified: ${userRecord.emailVerified}`);
    console.log(`   Creado: ${userRecord.metadata.creationTime}`);
    console.log(`   Último login: ${userRecord.metadata.lastSignInTime || '(nunca)'}`);
    console.log('');
  });
}

listAllUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
