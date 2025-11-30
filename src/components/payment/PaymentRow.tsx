import { CreditCard, Store, Check, Plus, Edit, X, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, cn } from '@/lib/utils';
import {
  getPaymentCardStyles,
  getStatusBadgeVariant,
  getStatusLabel,
} from '@/lib/paymentCardStyles';
import type { PaymentStatus, PartialPayment } from '@/lib/types';
import { PaymentMethodLabel } from './PaymentMethodLabel';

// Types
export interface PaymentRowData {
  id: string;
  description: string;
  amount: number;
  dueDate: Date;
  paymentType: 'card_payment' | 'service_payment';
  cardId?: string;
  serviceId?: string;
  // Para instancias (calendar)
  status?: PaymentStatus;
  remainingAmount?: number;
  paidAmount?: number;
  partialPayments?: PartialPayment[];
  notes?: string;
  // Para plantillas (payments)
  isActive?: boolean;
  frequency?: string;
}

export interface PaymentRowActions {
  // Calendar actions
  onMarkPaid?: (id: string) => void;
  onPartialPayment?: (id: string) => void;
  onAdjust?: (id: string) => void;
  onCancel?: (id: string) => void;
  onUnmark?: (id: string) => void;
  onDeletePartial?: (id: string, paymentId: string) => void;
  // Payments actions
  onToggleActive?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  // Shared
  onViewCard?: (cardId: string) => void;
}

interface PaymentRowProps {
  data: PaymentRowData;
  actions: PaymentRowActions;
  variant: 'calendar' | 'payments';
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  // Helpers
  getCardName: (cardId: string) => string;
  getServiceName: (serviceId: string) => string;
  getServicePaymentMethod: (serviceId: string) => 'card' | 'transfer';
}

// Subcomponente: Acciones del Calendario
function CalendarActions({ data, actions }: { data: PaymentRowData; actions: PaymentRowActions }) {
  return (
    <>
      {data.status === 'pending' && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-status-paid hover:bg-status-paid-bg"
            onClick={() => actions.onMarkPaid?.(data.id)}
            title="Marcar como pagado"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-status-partial hover:bg-status-partial-bg"
            onClick={() => actions.onPartialPayment?.(data.id)}
            title="Pago parcial"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </>
      )}
      {data.status === 'partial' && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-status-partial hover:bg-status-partial-bg"
            onClick={() => actions.onPartialPayment?.(data.id)}
            title="Abonar"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-status-paid hover:bg-status-paid-bg"
            onClick={() => actions.onMarkPaid?.(data.id)}
            title="Completar pago"
          >
            <Check className="h-4 w-4" />
          </Button>
        </>
      )}
      {data.status === 'paid' && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:bg-muted"
          onClick={() => actions.onUnmark?.(data.id)}
          title="Desmarcar"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      )}
      {(data.status === 'pending' || data.status === 'partial') && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => actions.onAdjust?.(data.id)}
            title="Ajustar monto"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
            onClick={() => actions.onCancel?.(data.id)}
            title="Cancelar"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      )}
    </>
  );
}

// Subcomponente: Acciones de Payments
function PaymentsActions({ data, actions }: { data: PaymentRowData; actions: PaymentRowActions }) {
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => actions.onToggleActive?.(data.id)}
        title={data.isActive ? 'Desactivar' : 'Activar'}
      >
        {data.isActive ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => actions.onEdit?.(data.id)}
        title="Editar"
      >
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
        onClick={() => actions.onDelete?.(data.id)}
        title="Eliminar"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );
}

// Subcomponente: Sección de Pagos Parciales
function PartialPaymentsSection({
  payments,
  totalAmount,
  paidAmount,
  onDelete,
}: {
  payments: PartialPayment[];
  totalAmount: number;
  paidAmount: number;
  onDelete: (paymentId: string) => void;
}) {
  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-1.5 flex-1 bg-status-partial-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-status-partial rounded-full"
            style={{ width: `${(paidAmount / totalAmount) * 100}%` }}
          />
        </div>
        <span className="text-xs text-status-partial font-medium">
          {Math.round((paidAmount / totalAmount) * 100)}%
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="font-medium text-status-paid">{formatCurrency(payment.amount)}</span>
            <span className="text-muted-foreground">
              {new Date(payment.paidDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(payment.id);
              }}
              className="h-5 w-5 p-0 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Componente Principal
export function PaymentRow({
  data,
  actions,
  variant,
  isSelected = false,
  onSelect,
  getCardName,
  getServiceName,
  getServicePaymentMethod,
}: PaymentRowProps) {
  const Icon = data.paymentType === 'card_payment' ? CreditCard : Store;
  const isPaidByCard =
    data.paymentType === 'service_payment' &&
    getServicePaymentMethod(data.serviceId || '') === 'card';

  // Determinar estado para estilos
  const status: PaymentStatus =
    variant === 'calendar'
      ? data.status || 'pending'
      : data.isActive
      ? 'pending'
      : 'cancelled';

  return (
    <div
      onClick={() => onSelect?.(data.id)}
      className={getPaymentCardStyles(status, isSelected)}
    >
      {/* Layout horizontal principal */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        {/* Izquierda: Icono + Descripción */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Icon className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                'font-medium text-sm sm:text-base truncate',
                status === 'cancelled' && 'line-through text-muted-foreground'
              )}
            >
              {data.description}
            </h3>
            {data.paymentType === 'card_payment' ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  actions.onViewCard?.(data.cardId || '');
                }}
                className="text-xs text-primary hover:underline truncate block"
              >
                Tarjeta: {getCardName(data.cardId || '')}
              </button>
            ) : (
              <p className="text-xs text-muted-foreground truncate">
                Servicio: {getServiceName(data.serviceId || '')}
              </p>
            )}
          </div>
        </div>

        {/* Centro: Grid de datos compacto */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 text-sm pl-8 sm:pl-0">
          {/* Monto */}
          <div className="min-w-[90px]">
            <p className="text-xs text-muted-foreground">Monto</p>
            <p
              className={cn(
                'font-semibold tabular-nums',
                status === 'paid' && 'line-through text-muted-foreground'
              )}
            >
              {formatCurrency(data.amount)}
            </p>
            {variant === 'calendar' &&
              data.status === 'partial' &&
              data.remainingAmount !== undefined && (
                <p className="text-xs text-status-partial">
                  Rest: {formatCurrency(data.remainingAmount)}
                </p>
              )}
          </div>

          {/* Fecha/Frecuencia */}
          <div className="min-w-[60px]">
            <p className="text-xs text-muted-foreground">
              {variant === 'calendar' ? 'Fecha' : 'Frecuencia'}
            </p>
            <p className="font-medium">
              {variant === 'calendar'
                ? data.dueDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                : data.frequency || 'Mensual'}
            </p>
          </div>

          {/* Método */}
          <PaymentMethodLabel isPaidByCard={isPaidByCard} />
        </div>

        {/* Derecha: Badge + Acciones */}
        <div
          className="flex items-center gap-2 flex-shrink-0 pl-8 sm:pl-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Badge de estado */}
          {variant === 'calendar' ? (
            <Badge variant={getStatusBadgeVariant(data.status || 'pending')}>
              {getStatusLabel(data.status || 'pending')}
            </Badge>
          ) : (
            <Badge variant={data.isActive ? 'default' : 'secondary'}>
              {data.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          )}

          {/* Acciones según variante */}
          <div className="flex gap-1">
            {variant === 'calendar' ? (
              <CalendarActions data={data} actions={actions} />
            ) : (
              <PaymentsActions data={data} actions={actions} />
            )}
          </div>

          {/* Indicador de selección */}
          {isSelected && (
            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Sección expandible: Pagos parciales (solo calendar) */}
      {variant === 'calendar' &&
        data.status === 'partial' &&
        data.partialPayments &&
        data.partialPayments.length > 0 && (
          <PartialPaymentsSection
            payments={data.partialPayments}
            totalAmount={data.amount}
            paidAmount={data.paidAmount || 0}
            onDelete={(paymentId) => actions.onDeletePartial?.(data.id, paymentId)}
          />
        )}

      {/* Notas */}
      {data.notes && (
        <p className="mt-2 text-xs text-muted-foreground italic truncate pl-8 sm:pl-0">
          {data.notes}
        </p>
      )}
    </div>
  );
}
