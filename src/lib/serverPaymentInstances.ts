import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

interface EnsurePaymentInstancesResult {
  success: boolean;
  skipped?: boolean;
  checkedCount: number;
  createdCount: number;
  existingCount: number;
}

interface EnsurePaymentInstancesOptions {
  force?: boolean;
}

export async function ensurePaymentInstances(options?: EnsurePaymentInstancesOptions): Promise<EnsurePaymentInstancesResult> {
  const callable = httpsCallable<EnsurePaymentInstancesOptions | undefined, EnsurePaymentInstancesResult>(
    functions,
    'ensurePaymentInstances'
  );
  const result = await callable(options);
  return result.data;
}
