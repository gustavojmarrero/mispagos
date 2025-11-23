import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Store, Edit, Trash2, CreditCard, Banknote, Eye } from 'lucide-react';
import type { Service, PaymentMethod } from '@/lib/types';

interface ServiceGridItemProps {
  service: Service;
  onView: (service: Service) => void;
  onEdit: (service: Service) => void;
  onDelete: (serviceId: string) => void;
}

const getPaymentMethodLabel = (method: PaymentMethod) => {
  return method === 'card' ? 'Tarjeta' : 'Transferencia';
};

const getPaymentMethodIcon = (method: PaymentMethod) => {
  return method === 'card' ? CreditCard : Banknote;
};

export function ServiceGridItem({ service, onView, onEdit, onDelete }: ServiceGridItemProps) {
  const PaymentIcon = getPaymentMethodIcon(service.paymentMethod);

  return (
    <Card
      className="relative hover:shadow-lg transition-all duration-300 sm:hover:scale-[1.02] border-border cursor-pointer"
      onClick={() => onView(service)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary flex-shrink-0" />
              <CardTitle className="text-base sm:text-lg font-bold break-words">
                {service.name}
              </CardTitle>
            </div>
            <CardDescription className="flex items-center gap-2 mt-2 text-sm">
              <PaymentIcon className="h-4 w-4" />
              <span>{getPaymentMethodLabel(service.paymentMethod)}</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onView(service); }}
            className="w-full sm:w-auto min-h-[44px]"
          >
            <Eye className="h-4 w-4 mr-1" />
            Ver
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onEdit(service); }}
            className="w-full sm:w-auto min-h-[44px]"
          >
            <Edit className="h-4 w-4 mr-1" />
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onDelete(service.id); }}
            className="w-full sm:w-auto min-h-[44px]"
          >
            <Trash2 className="h-4 w-4 mr-1 text-destructive" />
            Eliminar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
