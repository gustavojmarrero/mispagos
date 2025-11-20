import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DayTimeline } from '@/lib/dashboardMetrics';
import { formatCurrency } from '@/lib/utils';
import { Calendar, TrendingUp } from 'lucide-react';

interface WeeklyTimelineProps {
  timeline: DayTimeline[];
}

export function WeeklyTimeline({ timeline }: WeeklyTimelineProps) {
  if (timeline.length === 0) {
    return null;
  }

  // Encontrar el día con más pagos para escalar visualmente
  const maxAmount = Math.max(...timeline.map((day) => day.totalAmount), 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
          <CardTitle className="text-base sm:text-lg">Próximos 7 Días</CardTitle>
        </div>
        <CardDescription className="text-sm">Vista día por día de pagos pendientes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {timeline.map((day, index) => {
            const heightPercentage = (day.totalAmount / maxAmount) * 100;
            const hasPayments = day.instances.length > 0;

            return (
              <div
                key={index}
                className={`p-3 rounded-lg border-2 transition-all ${
                  day.isToday
                    ? 'bg-primary/5 border-primary/50'
                    : hasPayments
                    ? 'bg-muted/30 border-muted'
                    : 'bg-background border-muted/30'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex flex-col">
                      <span
                        className={`text-sm sm:text-base font-semibold ${
                          day.isToday ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {day.dayName}
                      </span>
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        {day.date.toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    </div>
                    {day.isToday && (
                      <Badge variant="default" className="text-xs">
                        Hoy
                      </Badge>
                    )}
                  </div>

                  <div className="text-left sm:text-right w-full sm:w-auto">
                    {hasPayments ? (
                      <>
                        <p className="text-base sm:text-lg font-bold">
                          {formatCurrency(day.totalAmount)}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {day.instances.length} pago{day.instances.length !== 1 ? 's' : ''}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin pagos</p>
                    )}
                  </div>
                </div>

                {/* Barra visual del monto */}
                {hasPayments && (
                  <div className="mt-2">
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          day.isToday
                            ? 'bg-primary'
                            : heightPercentage > 70
                            ? 'bg-destructive'
                            : heightPercentage > 40
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${heightPercentage}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Lista compacta de pagos */}
                {hasPayments && day.instances.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {day.instances.slice(0, 3).map((instance) => (
                      <div
                        key={instance.id}
                        className="flex items-center justify-between text-xs sm:text-sm p-2 bg-background rounded border gap-2"
                      >
                        <span className="truncate flex-1 text-muted-foreground min-w-0">
                          {instance.description}
                        </span>
                        <span className="font-semibold ml-2 flex-shrink-0">
                          {formatCurrency(instance.amount)}
                        </span>
                      </div>
                    ))}
                    {day.instances.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        +{day.instances.length - 3} más
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Resumen visual */}
        <div className="mt-4 p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm font-medium">Resumen de la semana</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
            <div>
              <p className="text-muted-foreground">Total</p>
              <p className="font-bold">
                {formatCurrency(
                  timeline.reduce((sum, day) => sum + day.totalAmount, 0)
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Pagos</p>
              <p className="font-bold">
                {timeline.reduce((sum, day) => sum + day.instances.length, 0)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Día más alto</p>
              <p className="font-bold">{formatCurrency(maxAmount)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
