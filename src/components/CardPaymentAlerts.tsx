import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CreditCard, Calendar, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CardAlert } from '@/lib/cardPaymentAlerts';

interface CardPaymentAlertsProps {
  alerts: CardAlert[];
}

export function CardPaymentAlerts({ alerts }: CardPaymentAlertsProps) {
  const navigate = useNavigate();

  if (alerts.length === 0) {
    return null;
  }

  const handleProgramPayment = (cardId: string) => {
    // Navegar a la página de pagos con la tarjeta preseleccionada
    navigate(`/payments?cardId=${cardId}`);
  };

  const handleViewCard = () => {
    // Navegar a la página de tarjetas
    navigate('/cards');
  };

  return (
    <Card className="border-2 border-destructive/50 bg-destructive/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-destructive">
            Tarjetas Requieren Pago
          </CardTitle>
        </div>
        <CardDescription>
          {alerts.length} tarjeta{alerts.length !== 1 ? 's' : ''} {alerts.length !== 1 ? 'necesitan' : 'necesita'} un pago programado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => {
          const { card, closingDate, daysAfterClosing, expectedDueDate } = alert;

          return (
            <div
              key={card.id}
              className="flex items-center justify-between p-4 bg-background rounded-lg border-2 border-destructive/30"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-destructive" />
                  <div>
                    <h4 className="font-semibold text-sm">
                      {card.name} (*{card.lastDigits})
                    </h4>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Cortó el {closingDate.getDate()} {closingDate.toLocaleDateString('es-ES', { month: 'short' })}
                      </p>
                      <Badge variant="destructive" className="text-xs">
                        Hace {daysAfterClosing} día{daysAfterClosing !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Pago esperado antes del {expectedDueDate.getDate()} {expectedDueDate.toLocaleDateString('es-ES', { month: 'short' })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewCard()}
                  className="text-xs"
                >
                  Ver tarjeta
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleProgramPayment(card.id)}
                  className="text-xs"
                >
                  Programar pago
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
