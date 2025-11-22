import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, X } from 'lucide-react';

export type DateRangePreset = 'this-week' | 'current-month' | 'last-month' | 'last-3-months' | 'last-6-months' | 'custom' | 'all';

export interface DateRange {
  from: Date | null;
  to: Date | null;
  preset: DateRangePreset;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const getPresetDates = (preset: DateRangePreset): { from: Date | null; to: Date | null } => {
    const now = new Date();

    switch (preset) {
      case 'this-week': {
        // Desde hoy hasta el próximo lunes inclusive
        const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const currentDay = now.getDay();
        const daysUntilMonday = currentDay === 0 ? 1 : currentDay === 1 ? 7 : (8 - currentDay);
        const to = new Date(now);
        to.setDate(now.getDate() + daysUntilMonday);
        to.setHours(23, 59, 59, 999);
        return { from, to };
      }
      case 'current-month': {
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        return { from, to };
      }
      case 'last-month': {
        const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        return { from, to };
      }
      case 'last-3-months': {
        const from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        return { from, to };
      }
      case 'last-6-months': {
        const from = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        return { from, to };
      }
      case 'all':
        return { from: null, to: null };
      default:
        return { from: null, to: null };
    }
  };

  const handlePresetChange = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setShowCustom(true);
      return;
    }

    setShowCustom(false);
    const dates = getPresetDates(preset);
    onChange({ ...dates, preset });
  };

  const handleCustomApply = () => {
    if (!customFrom || !customTo) return;

    const from = new Date(customFrom);
    const to = new Date(customTo);
    to.setHours(23, 59, 59, 999);

    onChange({ from, to, preset: 'custom' });
    setShowCustom(false);
  };

  const handleClear = () => {
    onChange({ from: null, to: null, preset: 'all' });
    setShowCustom(false);
    setCustomFrom('');
    setCustomTo('');
  };

  const formatDateRange = () => {
    if (!value.from || !value.to) return 'Todos los datos';

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return `${formatDate(value.from)} - ${formatDate(value.to)}`;
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Período:</span>
            </div>
            <div className="flex-1 w-full sm:w-auto">
              <Select value={value.preset} onValueChange={(v: DateRangePreset) => handlePresetChange(v)}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los datos</SelectItem>
                  <SelectItem value="this-week">Esta semana</SelectItem>
                  <SelectItem value="current-month">Mes actual</SelectItem>
                  <SelectItem value="last-month">Mes anterior</SelectItem>
                  <SelectItem value="last-3-months">Últimos 3 meses</SelectItem>
                  <SelectItem value="last-6-months">Últimos 6 meses</SelectItem>
                  <SelectItem value="custom">Personalizado...</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {value.preset !== 'all' && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{formatDateRange()}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {showCustom && (
            <div className="border-t pt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="from">Desde</Label>
                  <Input
                    id="from"
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="to">Hasta</Label>
                  <Input
                    id="to"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    min={customFrom}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowCustom(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleCustomApply}
                  disabled={!customFrom || !customTo}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
