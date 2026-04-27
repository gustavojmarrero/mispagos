import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

interface EnsurePaymentInstancesResult {
  success: boolean;
  checkedCount: number;
  createdCount: number;
  existingCount: number;
}

export async function ensurePaymentInstances(): Promise<EnsurePaymentInstancesResult> {
  const callable = httpsCallable<undefined, EnsurePaymentInstancesResult>(
    functions,
    'ensurePaymentInstances'
  );
  const result = await callable(undefined);
  return result.data;
}
