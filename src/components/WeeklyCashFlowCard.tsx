import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { WeeklyCashFlow } from '@/lib/dashboardMetrics';
import type { DateRange } from '@/components/dashboard/DateRangeFilter';
import { formatCurrency } from '@/lib/utils';
import { Banknote, CreditCard, Calendar, AlertTriangle } from 'lucide-react';
import { getPeriodContext, getWeeksInPeriod, getMonthsInPeriod } from '@/utils/periodContext';

interface WeeklyCashFlowCardProps {
  cashFlow: WeeklyCashFlow;
  dateRange: DateRange;
}

export function WeeklyCashFlowCard({ cashFlow, dateRange }: WeeklyCashFlowCardProps) {
  const { thisWeek, thisMonth } = cashFlow;
  const periodContext = getPeriodContext(dateRange.preset, dateRange.from, dateRange.to);

  // Calcular promedios para períodos históricos
  const weekValue = periodContext.isHistorical && dateRange.from && dateRange.to
    ? thisWeek.totalPending / getWeeksInPeriod(dateRange.from, dateRange.to)
    : thisWeek.totalPending;

  const monthValue = periodContext.aggregationType === 'monthly' && dateRange.from && dateRange.to
    ? thisMonth.totalPending / getMonthsInPeriod(dateRange.from, dateRange.to)
    : thisMonth.totalPending;

  return (
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
      {/* Esta Semana / Promedio */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
              <CardTitle className="text-base sm:text-lg">{periodContext.weekLabel}</CardTitle>
            </div>
            {!periodContext.isHistorical && thisWeek.urgent > 0 && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {thisWeek.urgent} urgente{thisWeek.urgent !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <CardDescription>
            {periodContext.isCurrent
              ? 'Pendientes hasta próximo lunes'
              : periodContext.aggregationType === 'weekly'
                ? 'Promedio por semana del período'
                : 'Total del período'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-baseline gap-1 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-bold">
                {formatCurrency(weekValue)}
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground">
                {periodContext.isHistorical
                  ? `(promedio de ${dateRange.from && dateRange.to ? getWeeksInPeriod(dateRange.from, dateRange.to) : 0} semanas)`
                  : `(${thisWeek.instancesCount} pago${thisWeek.instancesCount !== 1 ? 's' : ''})`
                }
              </span>
            </div>
          </div>

          {/* Desglose por método de pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <Banknote className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-green-900">Transferencia</span>
              </div>
              <p className="text-base sm:text-lg font-bold text-green-700">
                {formatCurrency(thisWeek.byTransfer)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-blue-900">Tarjeta</span>
              </div>
              <p className="text-base sm:text-lg font-bold text-blue-700">
                {formatCurrency(thisWeek.byCard)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Este Mes / Total del Período */}
      <Card className="border-2 border-muted">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">{periodContext.monthLabel}</CardTitle>
          <CardDescription className="text-sm">
            {periodContext.aggregationType === 'monthly'
              ? 'Promedio mensual del período'
              : periodContext.isCurrent
                ? 'Progreso mensual de pagos'
                : 'Total del período seleccionado'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-baseline gap-1 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-bold">
                {formatCurrency(monthValue)}
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground">
                {periodContext.aggregationType === 'monthly'
                  ? `(promedio de ${dateRange.from && dateRange.to ? getMonthsInPeriod(dateRange.from, dateRange.to) : 0} meses)`
                  : periodContext.isCurrent
                    ? 'pendiente'
                    : 'total'
                }
              </span>
            </div>
          </div>

          {/* Barra de progreso - Solo para período actual */}
          {periodContext.isCurrent && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progreso</span>
                <span className="font-medium">
                  {Math.round(thisMonth.percentagePaid)}% completado
                </span>
              </div>
              <Progress value={thisMonth.percentagePaid} className="h-2" />
            </div>
          )}

          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3 sm:gap-2 text-sm">
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm">Pagado</p>
              <p className="font-semibold text-base sm:text-sm text-green-600">
                {formatCurrency(thisMonth.totalPaid)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm">Restante</p>
              <p className="font-semibold text-base sm:text-sm text-orange-600">
                {formatCurrency(thisMonth.remaining)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
