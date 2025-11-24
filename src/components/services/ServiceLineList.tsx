import { useState } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ServiceLineForm } from './ServiceLineForm';
import {
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Phone,
  FileText,
  Hash,
  Calendar,
  CalendarClock,
  Loader2,
} from 'lucide-react';
import type { Service, ServiceLine, ServiceLineFormData } from '@/lib/types';
import { useServiceLines } from '@/hooks/useServiceLines';

interface ServiceLineListProps {
  service: Service;
  onLinesChange?: () => void;
}

export function ServiceLineList({ service, onLinesChange }: ServiceLineListProps) {
  const { currentUser } = useAuth();
  const { serviceLines, loading, refetch } = useServiceLines({
    serviceId: service.id,
    activeOnly: false, // Mostrar todas, activas e inactivas
  });

  const [showForm, setShowForm] = useState(false);
  const [editingLine, setEditingLine] = useState<ServiceLine | null>(null);

  const handleCreateLine = async (data: Omit<ServiceLineFormData, 'serviceId'>) => {
    if (!currentUser) return;

    try {
      await addDoc(collection(db, 'service_lines'), {
        ...data,
        serviceId: service.id,
        householdId: currentUser.householdId,
        userId: currentUser.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        updatedBy: currentUser.id,
        updatedByName: currentUser.name,
      });

      toast.success('Línea creada exitosamente');
      await refetch();
      onLinesChange?.();
    } catch (error) {
      console.error('Error creating service line:', error);
      toast.error('Error al crear la línea');
      throw error;
    }
  };

  const handleUpdateLine = async (data: Omit<ServiceLineFormData, 'serviceId'>) => {
    if (!currentUser || !editingLine) return;

    try {
      await updateDoc(doc(db, 'service_lines', editingLine.id), {
        ...data,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.id,
        updatedByName: currentUser.name,
      });

      toast.success('Línea actualizada exitosamente');
      setEditingLine(null);
      await refetch();
      onLinesChange?.();
    } catch (error) {
      console.error('Error updating service line:', error);
      toast.error('Error al actualizar la línea');
      throw error;
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta línea?')) return;

    try {
      await deleteDoc(doc(db, 'service_lines', lineId));
      toast.success('Línea eliminada exitosamente');
      await refetch();
      onLinesChange?.();
    } catch (error) {
      console.error('Error deleting service line:', error);
      toast.error('Error al eliminar la línea');
    }
  };

  const handleEdit = (line: ServiceLine) => {
    setEditingLine(line);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingLine(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">
          Líneas de Servicio ({serviceLines.length})
        </h4>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar
        </Button>
      </div>

      {serviceLines.length === 0 ? (
        <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed">
          <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No hay líneas configuradas
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Agrega líneas para configurar diferentes ciclos de facturación
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Crear primera línea
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {serviceLines.map((line) => (
            <div
              key={line.id}
              className={`p-3 rounded-lg border ${
                line.isActive
                  ? 'bg-background'
                  : 'bg-muted/30 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{line.name}</span>
                    {!line.isActive && (
                      <Badge variant="secondary" className="text-xs">
                        Inactiva
                      </Badge>
                    )}
                  </div>

                  {/* Identificadores */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                    {line.lineNumber && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {line.lineNumber}
                      </span>
                    )}
                    {line.contractNumber && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {line.contractNumber}
                      </span>
                    )}
                    {line.accountNumber && (
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {line.accountNumber}
                      </span>
                    )}
                  </div>

                  {/* Ciclo de facturación */}
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="flex items-center gap-1 text-orange-600">
                      <Calendar className="h-3 w-3" />
                      Corte: {line.billingCycleDay}
                    </span>
                    <span className="flex items-center gap-1 text-red-600">
                      <CalendarClock className="h-3 w-3" />
                      Vence: {line.billingDueDay}
                    </span>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(line)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteLine(line.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      <ServiceLineForm
        open={showForm}
        onOpenChange={handleFormClose}
        serviceName={service.name}
        editingLine={editingLine}
        onSubmit={editingLine ? handleUpdateLine : handleCreateLine}
      />
    </div>
  );
}
