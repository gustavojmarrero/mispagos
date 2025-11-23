import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Store, Edit, Trash2, MoreVertical, CreditCard, Banknote, Eye } from 'lucide-react';
import type { Service, PaymentMethod } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ServiceListItemProps {
  service: Service;
  onView: (service: Service) => void;
  onEdit: (service: Service) => void;
  onDelete: (serviceId: string) => void;
}

const getPaymentMethodLabel = (method: PaymentMethod) => {
  return method === 'card' ? 'Tarjeta' : 'Transferencia';
};

const getPaymentMethodBadgeColor = (method: PaymentMethod) => {
  return method === 'card'
    ? 'bg-blue-100 text-blue-700'
    : 'bg-green-100 text-green-700';
};

export function ServiceListItem({ service, onView, onEdit, onDelete }: ServiceListItemProps) {
  const PaymentIcon = service.paymentMethod === 'card' ? CreditCard : Banknote;

  return (
    <div
      className="flex items-center gap-4 p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow group cursor-pointer"
      onClick={() => onView(service)}
    >
      {/* Icono y nombre */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="bg-primary/10 p-2 rounded-lg shrink-0">
          <Store className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <span className="font-medium text-sm truncate block">{service.name}</span>
        </div>
      </div>

      {/* Método de pago con icono - visible en sm+ */}
      <div className="hidden sm:flex items-center gap-2 w-[130px]">
        <PaymentIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <Badge className={`text-[10px] px-2 py-0.5 ${getPaymentMethodBadgeColor(service.paymentMethod)} border-0`}>
          {getPaymentMethodLabel(service.paymentMethod)}
        </Badge>
      </div>

      {/* Acciones - desktop */}
      <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onView(service); }}
          className="h-7 px-2"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onEdit(service); }}
          className="h-7 px-2"
        >
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onDelete(service.id); }}
          className="h-7 px-2"
        >
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
            <DropdownMenuItem onClick={() => onView(service)}>
              <Eye className="h-4 w-4 mr-2" />
              Ver
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(service)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(service.id)} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
