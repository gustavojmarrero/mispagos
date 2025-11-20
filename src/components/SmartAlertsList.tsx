import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { SmartAlert } from '@/lib/dashboardMetrics';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CreditCard,
  Calendar,
  TrendingUp,
  Wallet,
  ArrowRight,
} from 'lucide-react';

interface SmartAlertsListProps {
  alerts: SmartAlert[];
}

export function SmartAlertsList({ alerts }: SmartAlertsListProps) {
  const navigate = useNavigate();

  if (alerts.length === 0) {
    return null;
  }

  const handleAction = (alert: SmartAlert) => {
    const route = alert.action.route;
    const params = alert.action.params;
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      navigate(`${route}?${queryString}`);
    } else {
      navigate(route);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'card_no_payment':
        return CreditCard;
      case 'overdue':
        return Calendar;
      case 'upcoming':
        return Calendar;
      case 'high_week':
        return TrendingUp;
      case 'low_credit':
        return Wallet;
      default:
        return AlertCircle;
    }
  };

  // Agrupar alertas por severidad
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');
  const infoAlerts = alerts.filter((a) => a.severity === 'info');

  return (
    <div className="space-y-3">
      {/* Alertas Críticas */}
      {criticalAlerts.length > 0 && (
        <Card className="border-2 border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Alertas Críticas</CardTitle>
            </div>
            <CardDescription>
              {criticalAlerts.length} alerta{criticalAlerts.length !== 1 ? 's' : ''} que requiere
              {criticalAlerts.length === 1 ? '' : 'n'} atención inmediata
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {criticalAlerts.map((alert) => {
              const TypeIcon = getTypeIcon(alert.type);
              return (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 bg-background rounded-lg border"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <TypeIcon className="h-5 w-5 text-destructive mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{alert.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {alert.description}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(alert)}
                    className="text-xs ml-3"
                  >
                    {alert.action.label}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Alertas de Advertencia */}
      {warningAlerts.length > 0 && (
        <Card className="border-2 border-yellow-500/50 bg-yellow-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-yellow-900">Advertencias</CardTitle>
            </div>
            <CardDescription>
              {warningAlerts.length} situación{warningAlerts.length !== 1 ? 'es' : ''} que
              requiere{warningAlerts.length === 1 ? '' : 'n'} tu atención
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {warningAlerts.map((alert) => {
              const TypeIcon = getTypeIcon(alert.type);
              return (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 bg-background rounded-lg border"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <TypeIcon className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{alert.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {alert.description}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(alert)}
                    className="text-xs ml-3"
                  >
                    {alert.action.label}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Alertas Informativas */}
      {infoAlerts.length > 0 && (
        <Card className="border-2 border-blue-500/50 bg-blue-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-blue-900">Información</CardTitle>
            </div>
            <CardDescription>
              Insights sobre tus finanzas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {infoAlerts.map((alert) => {
              const TypeIcon = getTypeIcon(alert.type);
              return (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 bg-background rounded-lg border"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <TypeIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{alert.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {alert.description}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(alert)}
                    className="text-xs ml-3"
                  >
                    {alert.action.label}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
