import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import type { PaymentInstance, Service } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface ServiceBillingHistoryProps {
  service: Service;
  instances: PaymentInstance[];
}

interface ChartData {
  month: string;
  amount: number;
  fullDate: string;
  status: string;
}

export function ServiceBillingHistory({ service, instances }: ServiceBillingHistoryProps) {
  // Filtrar instancias pagadas de este servicio (últimos 12 meses)
  const chartData = useMemo(() => {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const serviceInstances = instances
      .filter(
        (instance) =>
          instance.serviceId === service.id &&
          (instance.status === 'paid' || instance.status === 'partial') &&
          instance.amount > 0 &&
          instance.dueDate >= twelveMonthsAgo
      )
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    // Agrupar por mes
    const monthlyData: Record<string, ChartData> = {};

    serviceInstances.forEach((instance) => {
      const date = instance.dueDate;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthNames[date.getMonth()],
          amount: 0,
          fullDate: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
          status: instance.status,
        };
      }

      // Acumular montos (por si hay múltiples pagos en un mes)
      monthlyData[monthKey].amount += instance.amount;
    });

    return Object.values(monthlyData);
  }, [service.id, instances]);

  // Calcular estadísticas
  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return {
        average: 0,
        min: 0,
        max: 0,
        trend: 'neutral' as const,
        trendPercentage: 0,
        lastAmount: 0,
      };
    }

    const amounts = chartData.map((d) => d.amount);
    const average = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const lastAmount = amounts[amounts.length - 1];

    // Calcular tendencia (comparar último con promedio de los anteriores)
    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    let trendPercentage = 0;

    if (amounts.length >= 2) {
      const previousAmounts = amounts.slice(0, -1);
      const previousAvg = previousAmounts.reduce((a, b) => a + b, 0) / previousAmounts.length;

      if (previousAvg > 0) {
        trendPercentage = ((lastAmount - previousAvg) / previousAvg) * 100;
        if (trendPercentage > 10) trend = 'up';
        else if (trendPercentage < -10) trend = 'down';
      }
    }

    return { average, min, max, trend, trendPercentage, lastAmount };
  }, [chartData]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartData;
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3">
          <p className="font-medium text-sm">{data.fullDate}</p>
          <p className="text-lg font-bold text-primary">
            {formatCurrency(data.amount)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (service.serviceType !== 'billing_cycle') {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Historial de Pagos</CardTitle>
            <CardDescription>Últimos 12 meses de {service.name}</CardDescription>
          </div>
          {chartData.length >= 2 && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
              stats.trend === 'up'
                ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                : stats.trend === 'down'
                ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400'
                : 'bg-muted text-muted-foreground'
            }`}>
              {stats.trend === 'up' ? (
                <TrendingUp className="h-4 w-4" />
              ) : stats.trend === 'down' ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              <span>
                {stats.trend === 'up' ? '+' : ''}
                {stats.trendPercentage.toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No hay pagos registrados</p>
            <p className="text-sm text-muted-foreground">
              El historial se mostrará cuando se registren pagos
            </p>
          </div>
        ) : (
          <>
            {/* Gráfica */}
            <div className="h-[200px] mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
                    className="fill-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    y={stats.average}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="5 5"
                    strokeOpacity={0.5}
                  />
                  <Bar
                    dataKey="amount"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Promedio</p>
                <p className="font-semibold text-sm">{formatCurrency(stats.average)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Mínimo</p>
                <p className="font-semibold text-sm text-green-600">{formatCurrency(stats.min)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Máximo</p>
                <p className="font-semibold text-sm text-red-600">{formatCurrency(stats.max)}</p>
              </div>
            </div>

            {/* Alerta de consumo anormal */}
            {stats.trend === 'up' && stats.trendPercentage > 25 && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800 dark:text-amber-200">
                    <p className="font-medium">Consumo elevado detectado</p>
                    <p className="mt-0.5">
                      El último pago es {stats.trendPercentage.toFixed(0)}% mayor al promedio.
                      {service.name.toLowerCase().includes('agua') && ' Revisa si hay fugas.'}
                      {service.name.toLowerCase().includes('luz') && ' Revisa aparatos conectados.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
