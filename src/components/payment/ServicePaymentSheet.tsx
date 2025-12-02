import { Store, CreditCard, Banknote, Calendar, TrendingUp, TrendingDown, Minus, Cable } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import type { ScheduledPayment, Service, ServiceLine, PaymentInstance } from '@/lib/types';

interface ServicePaymentSheetProps {
  payment: ScheduledPayment | null;
  service: Service | null;
  serviceLine: ServiceLine | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentHistory: PaymentInstance[];
  loadingHistory?: boolean;
}

// Obtener etiqueta de frecuencia
function getFrequencyLabel(payment: ScheduledPayment): string {
  if (payment.paymentType === 'card_payment') {
    return payment.paymentDate
      ? payment.paymentDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Sin fecha';
  }

  switch (payment.frequency) {
    case 'monthly':
      return `Mensual (día ${payment.dueDay})`;
    case 'weekly': {
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      return `Semanal (${days[payment.dayOfWeek || 0]})`;
    }
    case 'once':
      return `Único (día ${payment.dueDay})`;
    case 'billing_cycle':
      return 'Ciclo de facturación';
    default:
      return 'Sin frecuencia';
  }
}

// Obtener etiqueta de tipo de servicio
function getServiceTypeLabel(serviceType: string): string {
  return serviceType === 'billing_cycle' ? 'Ciclo de facturación' : 'Monto fijo';
}

// Obtener etiqueta de método de pago
function getPaymentMethodLabel(method: string): { label: string; icon: typeof CreditCard } {
  return method === 'card'
    ? { label: 'Tarjeta', icon: CreditCard }
    : { label: 'Transferencia', icon: Banknote };
}

// Calcular estadísticas del historial
function calculateStats(history: PaymentInstance[]) {
  if (history.length === 0) return null;

  const amounts = history.map((p) => p.paidAmount || p.amount);
  const total = amounts.reduce((sum, a) => sum + a, 0);
  const avg = total / amounts.length;
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);

  return { avg, min, max, count: history.length };
}

export function ServicePaymentSheet({
  payment,
  service,
  serviceLine,
  open,
  onOpenChange,
  paymentHistory,
  loadingHistory = false,
}: ServicePaymentSheetProps) {
  if (!payment || !service) return null;

  const stats = calculateStats(paymentHistory);
  const { label: methodLabel, icon: MethodIcon } = getPaymentMethodLabel(service.paymentMethod);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg truncate">{payment.description}</SheetTitle>
              <SheetDescription className="truncate">{service.name}</SheetDescription>
            </div>
            <Badge variant={payment.isActive ? 'default' : 'secondary'}>
              {payment.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Información del Pago */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Información del Pago</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Monto</p>
                <p className="text-lg font-semibold">{formatCurrency(payment.amount)}</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Frecuencia</p>
                <p className="font-medium text-sm">{getFrequencyLabel(payment)}</p>
              </div>
            </div>
            {payment.frequency === 'billing_cycle' && payment.paymentDate && (
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Próximo vencimiento</p>
                <p className="font-medium">
                  {payment.paymentDate.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Información del Servicio */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Servicio</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Tipo</p>
                <p className="font-medium">{getServiceTypeLabel(service.serviceType)}</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Método de pago</p>
                <div className="flex items-center gap-2">
                  <MethodIcon className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{methodLabel}</p>
                </div>
              </div>
            </div>
            {service.serviceType === 'billing_cycle' && service.billingCycleDay && service.billingDueDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 p-3 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Día de corte</p>
                  <p className="text-2xl font-bold">{service.billingCycleDay}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Día límite</p>
                  <p className="text-2xl font-bold">{service.billingDueDay}</p>
                </div>
              </div>
            )}
          </div>

          {/* Línea de Servicio (si existe) */}
          {serviceLine && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Línea de Servicio</h4>
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Cable className="h-5 w-5 text-primary" />
                  <span className="font-medium">{serviceLine.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {serviceLine.lineNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">Número</p>
                      <p className="font-mono">{serviceLine.lineNumber}</p>
                    </div>
                  )}
                  {serviceLine.contractNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">Contrato</p>
                      <p className="font-mono">{serviceLine.contractNumber}</p>
                    </div>
                  )}
                  {serviceLine.accountNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">Cuenta</p>
                      <p className="font-mono">{serviceLine.accountNumber}</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Día de corte</p>
                    <p className="text-xl font-bold">{serviceLine.billingCycleDay}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Día límite</p>
                    <p className="text-xl font-bold">{serviceLine.billingDueDay}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Historial de Pagos */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium text-muted-foreground">Historial de Pagos</h4>
            </div>

            {loadingHistory ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="bg-muted/50 p-4 rounded-lg text-center text-muted-foreground text-sm">
                No hay pagos registrados
              </div>
            ) : (
              <>
                {/* Estadísticas */}
                {stats && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-green-50 dark:bg-green-950/30 p-2 rounded-lg text-center">
                      <TrendingDown className="h-3 w-3 text-green-600 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Mín</p>
                      <p className="text-sm font-semibold text-green-600">{formatCurrency(stats.min)}</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded-lg text-center">
                      <Minus className="h-3 w-3 text-blue-600 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Prom</p>
                      <p className="text-sm font-semibold text-blue-600">{formatCurrency(stats.avg)}</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-950/30 p-2 rounded-lg text-center">
                      <TrendingUp className="h-3 w-3 text-orange-600 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Máx</p>
                      <p className="text-sm font-semibold text-orange-600">{formatCurrency(stats.max)}</p>
                    </div>
                  </div>
                )}

                {/* Lista de pagos */}
                <div className="space-y-2">
                  {paymentHistory.map((instance) => (
                    <div
                      key={instance.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {instance.dueDate.toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        {instance.paidDate && (
                          <p className="text-xs text-muted-foreground">
                            Pagado:{' '}
                            {instance.paidDate.toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">
                          {formatCurrency(instance.paidAmount || instance.amount)}
                        </p>
                        <Badge
                          variant={instance.status === 'paid' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {instance.status === 'paid' ? 'Pagado' : 'Parcial'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
