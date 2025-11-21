import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, getCardIcon } from '@/lib/utils';
import type { Card as CardType } from '@/lib/types';
import { Edit, Trash2, Building2 } from 'lucide-react';

interface CardGridItemProps {
  card: CardType;
  bankName: string;
  onEdit: (card: CardType) => void;
  onDelete: (cardId: string) => void;
}

export function CardGridItem({ card, bankName, onEdit, onDelete }: CardGridItemProps) {
  const usagePercent = card.creditLimit > 0
    ? (card.currentBalance / card.creditLimit) * 100
    : 0;

  const getUsageColor = (percent: number) => {
    if (percent < 50) return 'bg-green-500';
    if (percent < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getUsageBadge = (percent: number) => {
    if (percent < 50) return { text: 'OK', color: 'bg-green-100 text-green-700' };
    if (percent < 80) return { text: 'Med', color: 'bg-yellow-100 text-yellow-700' };
    return { text: 'Alto', color: 'bg-red-100 text-red-700' };
  };

  const badge = getUsageBadge(usagePercent);

  return (
    <Card className="hover:shadow-md transition-shadow duration-200 group">
      <CardContent className="p-4">
        {/* Header con icono y nombre */}
        <div className="flex items-start gap-3 mb-3">
          <div className="bg-gray-50 p-1.5 rounded-lg shrink-0">
            <img src={getCardIcon(card.cardType)} alt={card.cardType} className="h-6 w-auto" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{card.name}</h3>
            <p className="text-xs text-muted-foreground font-mono">**** {card.lastDigits}</p>
          </div>
          <Badge className={`text-[10px] px-1.5 py-0 ${badge.color} border-0 shrink-0`}>
            {badge.text}
          </Badge>
        </div>

        {/* Info compacta */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span className="truncate">{bankName}</span>
            <span className="mx-1">•</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {card.owner}
            </Badge>
          </div>

          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">Saldo</span>
            <span className="font-semibold text-sm">{formatCurrency(card.currentBalance)}</span>
          </div>

          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">Disponible</span>
            <span className="text-sm text-green-600">{formatCurrency(card.availableCredit)}</span>
          </div>
        </div>

        {/* Barra de utilización mini */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-muted-foreground">Utilización</span>
            <span className="text-[10px] text-muted-foreground">{usagePercent.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={`${getUsageColor(usagePercent)} h-1.5 rounded-full transition-all`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Fechas compactas */}
        <div className="flex justify-between text-[10px] text-muted-foreground mb-3 pb-3 border-b">
          <span>Corte: día {card.closingDay}</span>
          <span>Pago: día {card.dueDay}</span>
        </div>

        {/* Acciones */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" onClick={() => onEdit(card)} className="flex-1 h-7 text-xs">
            <Edit className="h-3 w-3 mr-1" />
            Editar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(card.id)} className="h-7 px-2">
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
