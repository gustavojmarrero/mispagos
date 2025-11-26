import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, getCardIcon, formatCardNumber, formatCLABE } from '@/lib/utils';
import type { Card, Bank } from '@/lib/types';

interface CardDetailSheetProps {
  card: Card | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  banks: Bank[];
  onEdit?: (card: Card) => void;
  children?: React.ReactNode;
}

export function CardDetailSheet({
  card,
  open,
  onOpenChange,
  banks,
  onEdit,
  children,
}: CardDetailSheetProps) {
  const getBankName = (bankId: string) => {
    const bank = banks.find((b) => b.id === bankId);
    return bank?.name || 'Sin banco';
  };

  if (!card) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3">
            <div className="bg-gray-50 p-2 rounded-lg">
              <img src={getCardIcon(card.cardType)} alt={card.cardType} className="h-8 w-auto" />
            </div>
            <div>
              <SheetTitle className="text-lg">{card.name}</SheetTitle>
              <SheetDescription className="font-mono">**** {card.lastDigits}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Información básica */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Información</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Propietario</p>
                <p className="font-medium">{card.owner}</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Banco</p>
                <p className="font-medium">{getBankName(card.bankId)}</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Tipo</p>
                <p className="font-medium">{card.cardType}</p>
              </div>
            </div>
          </div>

          {/* Números de tarjeta */}
          {(card.physicalCardNumber || card.digitalCardNumber || card.clabeAccount) && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Números</h4>
              <div className="space-y-2">
                {card.physicalCardNumber && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Tarjeta Física</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-sm">{formatCardNumber(card.physicalCardNumber)}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(card.physicalCardNumber || '');
                          toast.success('Número de tarjeta física copiado');
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
                {card.digitalCardNumber && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Tarjeta Digital</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-sm">{formatCardNumber(card.digitalCardNumber)}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(card.digitalCardNumber || '');
                          toast.success('Número de tarjeta digital copiado');
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
                {card.clabeAccount && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">CLABE</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-sm">{formatCLABE(card.clabeAccount)}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(card.clabeAccount || '');
                          toast.success('CLABE copiada');
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Límites y saldos */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Límites y Saldos</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Límite de Crédito</span>
                <span className="font-semibold">{formatCurrency(card.creditLimit)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Disponible</span>
                <span className="font-semibold text-green-600">{formatCurrency(card.availableCredit)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Saldo Actual</span>
                <span className="font-semibold">{formatCurrency(card.currentBalance)}</span>
              </div>
            </div>
          </div>

          {/* Fechas */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Fechas de Pago</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Día de Corte</p>
                <p className="text-2xl font-bold">{card.closingDay}</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Día de Pago</p>
                <p className="text-2xl font-bold">{card.dueDay}</p>
              </div>
            </div>
          </div>

          {/* Comentarios */}
          {card.comments && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Comentarios</h4>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{card.comments}</p>
              </div>
            </div>
          )}

          {/* Contenido adicional (pagos programados en Cards.tsx) */}
          {children}
        </div>

        {onEdit && (
          <SheetFooter className="mt-6">
            <Button onClick={() => onEdit(card)} className="w-full">
              Editar Tarjeta
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
