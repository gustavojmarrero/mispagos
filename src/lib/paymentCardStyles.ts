import { cn } from '@/lib/utils';
import type { PaymentStatus } from '@/lib/types';

/**
 * Genera las clases CSS para una card de pago basándose en su estado y selección
 */
export function getPaymentCardStyles(
  status: PaymentStatus,
  isSelected: boolean
): string {
  const base = cn(
    "border rounded-lg p-3 sm:p-4",
    "transition-all duration-200 ease-out",
    "cursor-pointer relative"
  );

  const statusStyles: Record<PaymentStatus, string> = {
    pending: cn(
      "bg-white border-status-pending-border",
      "hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5"
    ),
    partial: cn(
      "bg-status-partial-bg border-status-partial-border",
      "border-l-4 border-l-status-partial",
      "hover:shadow-md hover:-translate-y-0.5"
    ),
    paid: cn(
      "bg-status-paid-bg/50 border-status-paid-border",
      "opacity-85"
    ),
    overdue: cn(
      "bg-status-overdue-bg border-status-overdue-border",
      "border-l-4 border-l-status-overdue",
      "hover:shadow-md hover:-translate-y-0.5"
    ),
    cancelled: cn(
      "bg-status-cancelled-bg border-status-cancelled-border",
      "opacity-60"
    ),
  };

  const selection = isSelected
    ? "ring-2 ring-primary/50 ring-offset-2 bg-primary/[0.02] border-primary/30"
    : "";

  return cn(base, statusStyles[status], selection);
}

/**
 * Retorna la variante del Badge según el estado del pago
 */
export function getStatusBadgeVariant(status: PaymentStatus) {
  const variants: Record<PaymentStatus, string> = {
    pending: "status-pending",
    partial: "status-partial",
    paid: "status-paid",
    overdue: "status-overdue",
    cancelled: "status-cancelled",
  };
  return variants[status] as "status-pending" | "status-partial" | "status-paid" | "status-overdue" | "status-cancelled";
}

/**
 * Retorna el texto del estado en español
 */
export function getStatusLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    pending: "Pendiente",
    partial: "Parcial",
    paid: "Pagado",
    overdue: "Vencido",
    cancelled: "Cancelado",
  };
  return labels[status];
}
