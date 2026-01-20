import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, getCardIcon } from '@/lib/utils';
import type { Card as CardType } from '@/lib/types';
import { Edit, Trash2, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getUsageColor, getUsageBadge, calculateUsagePercent } from '@/lib/cardUtils';

interface CardListItemProps {
  card: CardType;
  bankName: string;
  onView: (card: CardType) => void;
  onEdit: (card: CardType) => void;
  onDelete: (cardId: string) => void;
}

export function CardListItem({ card, bankName, onView, onEdit, onDelete }: CardListItemProps) {
  const usagePercent = calculateUsagePercent(card.currentBalance, card.creditLimit);
  const badge = getUsageBadge(usagePercent, false);

  return (
    <div
      className="flex items-center gap-4 p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow group cursor-pointer"
      onClick={() => onView(card)}
    >
      {/* Icono y nombre */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="bg-gray-50 p-1.5 rounded-lg shrink-0">
          <img src={getCardIcon(card.cardType)} alt={card.cardType} className="h-5 w-auto" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{card.name}</span>
            <span className="text-xs text-muted-foreground font-mono">*{card.lastDigits}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{bankName}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {card.owner}
            </Badge>
          </div>
        </div>
      </div>

      {/* Saldo - visible en tablet+ */}
      <div className="hidden sm:block text-right w-[120px]">
        <div className="text-xs text-muted-foreground">Saldo</div>
        <div className="font-semibold text-sm">{formatCurrency(card.currentBalance)}</div>
      </div>

      {/* Disponible - visible en tablet+ */}
      <div className="hidden md:block text-right w-[110px]">
        <div className="text-xs text-muted-foreground">Disponible</div>
        <div className="text-sm text-green-600">{formatCurrency(card.availableCredit)}</div>
      </div>

      {/* Utilización con barra - visible en lg+ */}
      <div className="hidden lg:flex items-center gap-2 min-w-[140px]">
        <div className="flex-1">
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={`${getUsageColor(usagePercent)} h-1.5 rounded-full`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-muted-foreground w-10 text-right">{usagePercent.toFixed(0)}%</span>
      </div>

      {/* Badge de estado */}
      <Badge className={`text-[10px] px-2 py-0.5 ${badge.color} border-0 shrink-0 hidden sm:inline-flex w-[75px] justify-center`}>
        {badge.text}
      </Badge>

      {/* Fechas - visible en xl+ */}
      <div className="hidden xl:flex items-center gap-3 text-xs text-muted-foreground min-w-[120px]">
        <span>Corte: {card.closingDay}</span>
        <span>Pago: {card.dueDay}</span>
      </div>

      {/* Acciones - desktop */}
      <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(card); }} className="h-7 px-2">
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(card.id); }} className="h-7 px-2">
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>

      {/* Acciones - mobile dropdown */}
      <div className="sm:hidden" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(card)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(card.id)} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
