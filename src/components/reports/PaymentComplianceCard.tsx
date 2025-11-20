import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import type { PaymentCompliance } from '@/lib/reportsMetrics';

interface PaymentComplianceCardProps {
  data: PaymentCompliance;
}

export function PaymentComplianceCard({ data }: PaymentComplianceCardProps) {
  const getComplianceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600 dark:text-green-400';
    if (rate >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getComplianceBgColor = (rate: number) => {
    if (rate >= 90) return 'bg-green-600';
    if (rate >= 70) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Cumplimiento de Pagos
        </CardTitle>
        <CardDescription>
          Rendimiento de tus pagos en el período seleccionado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Compliance Rate Circle */}
        <div className="flex items-center justify-center">
          <div className="relative h-40 w-40">
            <svg className="transform -rotate-90" viewBox="0 0 120 120">
              {/* Background circle */}
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-muted"
                opacity="0.2"
              />
              {/* Progress circle */}
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className={getComplianceBgColor(data.complianceRate)}
                strokeDasharray={`${(data.complianceRate / 100) * 339.292} 339.292`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${getComplianceColor(data.complianceRate)}`}>
                {data.complianceRate.toFixed(0)}%
              </span>
              <span className="text-xs text-muted-foreground">Cumplimiento</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2 text-center">
            <div className="flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.completedOnTime}</p>
              <p className="text-xs text-muted-foreground">A Tiempo</p>
            </div>
          </div>

          <div className="space-y-2 text-center">
            <div className="flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.pending}</p>
              <p className="text-xs text-muted-foreground">Pendientes</p>
            </div>
          </div>

          <div className="space-y-2 text-center">
            <div className="flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.overdue}</p>
              <p className="text-xs text-muted-foreground">Vencidos</p>
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="border-t pt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Total de pagos en período: <span className="font-semibold text-foreground">{data.total}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
