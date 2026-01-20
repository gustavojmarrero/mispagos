import type { PaymentInstance } from './types';

/**
 * Calcula el monto a pagar de una instancia de pago,
 * considerando pagos parciales (remainingAmount)
 */
export function getAmountToPay(instance: PaymentInstance): number {
  if (instance.status === 'partial' && instance.remainingAmount !== undefined) {
    return instance.remainingAmount;
  }
  return instance.amount;
}

/**
 * Calcula el total a pagar de un array de instancias de pago
 */
export function getTotalAmountToPay(instances: PaymentInstance[]): number {
  return instances.reduce((sum, instance) => sum + getAmountToPay(instance), 0);
}
