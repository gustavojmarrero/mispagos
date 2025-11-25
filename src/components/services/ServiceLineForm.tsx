import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Phone, FileText, Hash } from 'lucide-react';
import type { ServiceLine, ServiceLineFormData } from '@/lib/types';

interface ServiceLineFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceName: string;
  editingLine?: ServiceLine | null;
  onSubmit: (data: Omit<ServiceLineFormData, 'serviceId'>) => Promise<void>;
}

export function ServiceLineForm({
  open,
  onOpenChange,
  serviceName,
  editingLine,
  onSubmit,
}: ServiceLineFormProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Omit<ServiceLineFormData, 'serviceId'>>({
    name: editingLine?.name || '',
    lineNumber: editingLine?.lineNumber || '',
    contractNumber: editingLine?.contractNumber || '',
    accountNumber: editingLine?.accountNumber || '',
    billingCycleDay: editingLine?.billingCycleDay || 1,
    billingDueDay: editingLine?.billingDueDay || 15,
    isActive: editingLine?.isActive ?? true,
  });

  // Reinicializar formData cuando editingLine cambie o el modal se abra
  useEffect(() => {
    if (open) {
      setFormData({
        name: editingLine?.name || '',
        lineNumber: editingLine?.lineNumber || '',
        contractNumber: editingLine?.contractNumber || '',
        accountNumber: editingLine?.accountNumber || '',
        billingCycleDay: editingLine?.billingCycleDay || 1,
        billingDueDay: editingLine?.billingDueDay || 15,
        isActive: editingLine?.isActive ?? true,
      });
    }
  }, [editingLine, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      await onSubmit(formData);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingLine ? 'Editar' : 'Nueva'} Línea de Servicio
          </DialogTitle>
          <DialogDescription>
            {editingLine ? 'Modifica los datos de la línea' : `Agrega una nueva línea para ${serviceName}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre descriptivo */}
          <div className="space-y-2">
            <Label htmlFor="lineName">Nombre/Alias *</Label>
            <Input
              id="lineName"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Línea Casa, Oficina, Local"
              required
            />
            <p className="text-xs text-muted-foreground">
              Un nombre que te ayude a identificar esta línea
            </p>
          </div>

          {/* Campos de identificación opcionales */}
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Identificadores (opcionales)
            </p>

            <div className="space-y-2">
              <Label htmlFor="lineNumber" className="text-sm flex items-center gap-2">
                <Phone className="h-3 w-3" />
                Número de línea
              </Label>
              <Input
                id="lineNumber"
                value={formData.lineNumber}
                onChange={(e) => setFormData({ ...formData, lineNumber: e.target.value })}
                placeholder="Ej: 5551234567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractNumber" className="text-sm flex items-center gap-2">
                <FileText className="h-3 w-3" />
                Número de contrato
              </Label>
              <Input
                id="contractNumber"
                value={formData.contractNumber}
                onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                placeholder="Ej: CT-2024-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountNumber" className="text-sm flex items-center gap-2">
                <Hash className="h-3 w-3" />
                Número de cuenta/RPU
              </Label>
              <Input
                id="accountNumber"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                placeholder="Ej: 123456789"
              />
            </div>
          </div>

          {/* Ciclo de facturación */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="billingCycleDay">Día de corte *</Label>
              <Select
                value={formData.billingCycleDay.toString()}
                onValueChange={(value) => setFormData({ ...formData, billingCycleDay: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Día del mes" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Día que llega el recibo
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billingDueDay">Día de vencimiento *</Label>
              <Select
                value={formData.billingDueDay.toString()}
                onValueChange={(value) => setFormData({ ...formData, billingDueDay: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Día del mes" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Fecha límite de pago
              </p>
            </div>
          </div>

          {/* Estado activo */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="isActive">Línea activa</Label>
              <p className="text-xs text-muted-foreground">
                Las líneas inactivas no generan pagos programados
              </p>
            </div>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                editingLine ? 'Actualizar' : 'Crear Línea'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
