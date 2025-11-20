import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CardPeriodAnalysis } from '@/lib/dashboardMetrics';
import { formatCurrency } from '@/lib/utils';
import { CreditCard, Calendar, CheckCircle, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';

interface CardPeriodAnalysisCardProps {
  analyses: CardPeriodAnalysis[];
}

export function CardPeriodAnalysisCard({ analyses }: CardPeriodAnalysisCardProps) {
  const navigate = useNavigate();

  if (analyses.length === 0) {
    return null;
  }

  const handleProgramPayment = (cardId: string) => {
    navigate(`/payments?cardId=${cardId}`);
  };

  const getStatusConfig = (status: 'covered' | 'not_programmed' | 'overdue') => {
    switch (status) {
      case 'covered':
        return {
          icon: CheckCircle,
          label: 'Cubierto',
          variant: 'secondary' as const,
          className: 'bg-green-50 border-green-200 text-green-700',
        };
      case 'not_programmed':
        return {
          icon: AlertTriangle,
          label: 'Sin programar',
          variant: 'destructive' as const,
          className: 'bg-yellow-50 border-yellow-200 text-yellow-700',
        };
      case 'overdue':
        return {
          icon: XCircle,
          label: 'Vencido',
          variant: 'destructive' as const,
          className: 'bg-red-50 border-red-200 text-red-700',
        };
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análisis de Tarjetas por Período</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {analyses.map((analysis) => {
          const { card, currentPeriod } = analysis;
          const statusConfig = getStatusConfig(currentPeriod.status);
          const StatusIcon = statusConfig.icon;

          return (
            <div
              key={card.id}
              className={`p-4 rounded-lg border-2 ${statusConfig.className}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <CreditCard className="h-5 w-5" />
                    <div>
                      <h4 className="font-semibold text-sm">
                        {card.name} (*{card.lastDigits})
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={statusConfig.variant} className="text-xs">
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Período Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Fecha de corte</p>
                      <p className="font-medium">
                        {currentPeriod.closingDate.getDate()}{' '}
                        {currentPeriod.closingDate.toLocaleDateString('es-ES', {
                          month: 'short',
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Vencimiento</p>
                      <p className="font-medium">
                        {currentPeriod.dueDate.getDate()}{' '}
                        {currentPeriod.dueDate.toLocaleDateString('es-ES', {
                          month: 'short',
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Días restantes</p>
                      <p className="font-medium">
                        {currentPeriod.daysUntilDue > 0
                          ? `${currentPeriod.daysUntilDue} días`
                          : 'Vencido'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Saldo actual</p>
                      <p className="font-bold">
                        {formatCurrency(currentPeriod.totalCharges)}
                      </p>
                    </div>
                  </div>

                  {/* Payment Info */}
                  {currentPeriod.hasProgrammedPayment && (
                    <div className="mt-3 p-2 rounded bg-background/50 border">
                      <p className="text-xs text-muted-foreground">Pago programado</p>
                      <p className="text-sm font-semibold">
                        {formatCurrency(currentPeriod.programmedAmount)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Button */}
                {currentPeriod.status !== 'covered' && (
                  <div className="ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleProgramPayment(card.id)}
                      className="text-xs whitespace-nowrap"
                    >
                      Programar pago
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
