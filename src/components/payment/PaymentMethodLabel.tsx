import { CreditCard, Banknote } from 'lucide-react';

interface PaymentMethodLabelProps {
  isPaidByCard: boolean;
}

export function PaymentMethodLabel({ isPaidByCard }: PaymentMethodLabelProps) {
  return (
    <div className="min-w-[80px]">
      <p className="text-xs text-muted-foreground">Método</p>
      <div className="flex items-center gap-1">
        {isPaidByCard ? (
          <>
            <CreditCard className="h-3.5 w-3.5 text-status-partial" />
            <span className="text-sm">Tarjeta</span>
          </>
        ) : (
          <>
            <Banknote className="h-3.5 w-3.5 text-status-paid" />
            <span className="text-sm">Transfer</span>
          </>
        )}
      </div>
    </div>
  );
}
