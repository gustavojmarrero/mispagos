import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import type { CreditSummary } from '@/lib/reportsMetrics';
import { CreditCard, Building2 } from 'lucide-react';

interface CreditSummaryCardProps {
  data: CreditSummary;
}

export function CreditSummaryCard({ data }: CreditSummaryCardProps) {
  const getUsageColor = (percent: number) => {
    if (percent < 50) return 'bg-green-500';
    if (percent < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getUsageTextColor = (percent: number) => {
    if (percent < 50) return 'text-green-600';
    if (percent < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Resumen de Crédito
        </CardTitle>
        <CardDescription>
          Crédito total otorgado y disponible por tipo de tarjeta
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Totales generales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Crédito Total</p>
            <p className="text-2xl font-bold">{formatCurrency(data.totalCreditLimit)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Disponible</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(data.totalAvailableCredit)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Utilizado</p>
            <p className={`text-2xl font-bold ${getUsageTextColor(data.totalUsagePercent)}`}>
              {formatCurrency(data.totalUsedCredit)}
            </p>
            <p className="text-xs text-muted-foreground">({data.totalUsagePercent.toFixed(1)}%)</p>
          </div>
        </div>

        {/* Barra de utilización total */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Utilización Total</span>
            <span>{data.totalUsagePercent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`${getUsageColor(data.totalUsagePercent)} h-3 rounded-full transition-all`}
              style={{ width: `${Math.min(data.totalUsagePercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Comparación Marca vs Departamental */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tarjetas de Marca */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-4 w-4 text-blue-600" />
              <h4 className="font-semibold">Tarjetas de Marca</h4>
              <span className="text-xs text-muted-foreground">({data.brandCards.cardCount} tarjetas)</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Límite:</span>
                <span className="font-medium">{formatCurrency(data.brandCards.creditLimit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Disponible:</span>
                <span className="font-medium text-green-600">{formatCurrency(data.brandCards.availableCredit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Utilizado:</span>
                <span className={`font-medium ${getUsageTextColor(data.brandCards.usagePercent)}`}>
                  {formatCurrency(data.brandCards.usedCredit)} ({data.brandCards.usagePercent.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className={`${getUsageColor(data.brandCards.usagePercent)} h-2 rounded-full`}
                  style={{ width: `${Math.min(data.brandCards.usagePercent, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Tarjetas Departamentales */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-purple-600" />
              <h4 className="font-semibold">Departamentales</h4>
              <span className="text-xs text-muted-foreground">({data.departamentalCards.cardCount} tarjetas)</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Límite:</span>
                <span className="font-medium">{formatCurrency(data.departamentalCards.creditLimit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Disponible:</span>
                <span className="font-medium text-green-600">{formatCurrency(data.departamentalCards.availableCredit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Utilizado:</span>
                <span className={`font-medium ${getUsageTextColor(data.departamentalCards.usagePercent)}`}>
                  {formatCurrency(data.departamentalCards.usedCredit)} ({data.departamentalCards.usagePercent.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className={`${getUsageColor(data.departamentalCards.usagePercent)} h-2 rounded-full`}
                  style={{ width: `${Math.min(data.departamentalCards.usagePercent, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Desglose por tipo */}
        {data.byType.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Desglose por Tipo</h4>
            <div className="space-y-3">
              {data.byType.map((type) => (
                <div key={type.type} className="flex items-center gap-4">
                  <div className="w-28 text-sm font-medium">{type.type}</div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`${getUsageColor(type.usagePercent)} h-2 rounded-full`}
                        style={{ width: `${Math.min(type.usagePercent, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-24 text-right text-sm">
                    <span className={getUsageTextColor(type.usagePercent)}>
                      {type.usagePercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-32 text-right text-sm text-muted-foreground">
                    {formatCurrency(type.availableCredit)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
