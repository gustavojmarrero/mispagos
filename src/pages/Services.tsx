import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Service, ServiceFormData, PaymentMethod, ServiceType, PaymentInstance } from '@/lib/types';
import { Store, Plus, X, Search, Loader2, CreditCard, Banknote, Edit, Calendar, CalendarCheck, Cable } from 'lucide-react';
import { ViewToggle, type ViewMode } from '@/components/ui/view-toggle';
import { ServiceGridItem } from '@/components/services/ServiceGridItem';
import { ServiceListItem } from '@/components/services/ServiceListItem';
import { ServiceBillingHistory } from '@/components/services/ServiceBillingHistory';
import { ServiceLineList } from '@/components/services/ServiceLineList';
import { useServiceLinesGrouped } from '@/hooks/useServiceLines';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export function Services() {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [paymentInstances, setPaymentInstances] = useState<PaymentInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [viewingService, setViewingService] = useState<Service | null>(null);
  const [editingFromView, setEditingFromView] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'method'>('name');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('services-view-mode');
    return (saved as ViewMode) || 'list';
  });
  const [formData, setFormData] = useState<ServiceFormData>({
    name: '',
    paymentMethod: 'transfer',
    serviceType: 'fixed',
  });

  // Hook para obtener líneas de servicio agrupadas
  const { linesCountByService, refetch: refetchServiceLines } = useServiceLinesGrouped();

  useEffect(() => {
    fetchServices();
    fetchPaymentInstances();
  }, [currentUser?.householdId]);

  // Abrir panel de servicio automáticamente si viene viewService en la URL (desde alertas del Dashboard)
  useEffect(() => {
    const viewServiceId = searchParams.get('viewService');
    if (viewServiceId && services.length > 0 && !loading) {
      const service = services.find(s => s.id === viewServiceId);
      if (service) {
        setViewingService(service);
      }
    }
  }, [searchParams, services, loading]);

  const fetchServices = async (): Promise<Service[]> => {
    if (!currentUser) return [];

    try {
      const servicesQuery = query(
        collection(db, 'services'),
        where('householdId', '==', currentUser.householdId)
      );
      const snapshot = await getDocs(servicesQuery);
      const servicesData = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Service[];

      setServices(servicesData);
      return servicesData;
    } catch (error) {
      console.error('Error fetching services:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentInstances = async () => {
    if (!currentUser) return;

    try {
      const instancesQuery = query(
        collection(db, 'payment_instances'),
        where('householdId', '==', currentUser.householdId)
      );
      const snapshot = await getDocs(instancesQuery);
      const instancesData = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        dueDate: doc.data().dueDate?.toDate() || new Date(),
        paidDate: doc.data().paidDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as PaymentInstance[];

      setPaymentInstances(instancesData);
    } catch (error) {
      console.error('Error fetching payment instances:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || saving) return;

    setSaving(true);
    try {
      // Filtrar campos undefined para evitar error de Firestore
      const dataToSave: Record<string, unknown> = {
        name: formData.name,
        paymentMethod: formData.paymentMethod,
        serviceType: formData.serviceType,
      };

      // Solo agregar campos de ciclo de facturación si tienen valor
      if (formData.billingCycleDay !== undefined) {
        dataToSave.billingCycleDay = formData.billingCycleDay;
      }
      if (formData.billingDueDay !== undefined) {
        dataToSave.billingDueDay = formData.billingDueDay;
      }

      if (editingService) {
        // Update - si el servicio cambió a tipo fijo, eliminar campos de ciclo
        if (formData.serviceType === 'fixed') {
          await updateDoc(doc(db, 'services', editingService.id), {
            ...dataToSave,
            billingCycleDay: null,
            billingDueDay: null,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.id,
            updatedByName: currentUser.name,
          });
        } else {
          await updateDoc(doc(db, 'services', editingService.id), {
            ...dataToSave,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.id,
            updatedByName: currentUser.name,
          });
        }
        toast.success('Servicio actualizado exitosamente');
      } else {
        // Create
        await addDoc(collection(db, 'services'), {
          ...dataToSave,
          userId: currentUser.id, // Mantener por compatibilidad
          householdId: currentUser.householdId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: currentUser.id,
          createdByName: currentUser.name,
          updatedBy: currentUser.id,
          updatedByName: currentUser.name,
        });
        toast.success('Servicio creado exitosamente');
      }

      const serviceIdToReopen = editingFromView;
      resetForm();
      const updatedServices = await fetchServices();

      // Si estábamos editando desde el Sheet, reabrir con el servicio actualizado
      if (serviceIdToReopen) {
        const updatedService = updatedServices.find(s => s.id === serviceIdToReopen);
        if (updatedService) {
          setViewingService(updatedService);
        }
      }
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error('Error al guardar el servicio');
    } finally {
      setSaving(false);
    }
  };

  const handleView = (service: Service) => {
    setViewingService(service);
  };

  const handleEditFromView = () => {
    if (viewingService) {
      setEditingFromView(viewingService.id); // Guardar ID para reabrir después
      setViewingService(null);
      handleEdit(viewingService);
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      paymentMethod: service.paymentMethod,
      serviceType: service.serviceType || 'fixed',
      billingCycleDay: service.billingCycleDay,
      billingDueDay: service.billingDueDay,
    });
    setShowForm(true);
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm('¿Estás seguro de eliminar este servicio?')) return;

    try {
      await deleteDoc(doc(db, 'services', serviceId));
      toast.success('Servicio eliminado exitosamente');
      await fetchServices();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('Error al eliminar el servicio');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      paymentMethod: 'transfer',
      serviceType: 'fixed',
      billingCycleDay: undefined,
      billingDueDay: undefined,
    });
    setEditingService(null);
    setEditingFromView(null);
    setShowForm(false);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('services-view-mode', mode);
  };

  // Filter and sort services
  const filteredAndSortedServices = useMemo(() => {
    let filtered = services;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((service) =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'method':
          return a.paymentMethod.localeCompare(b.paymentMethod);
        default:
          return 0;
      }
    });

    return sorted;
  }, [services, searchTerm, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Servicios</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Gestiona los servicios que pagas mensualmente</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="hidden sm:flex w-full sm:w-auto">
          {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showForm ? 'Cancelar' : 'Nuevo Servicio'}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="shadow-md border-border">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
            <CardTitle className="text-xl sm:text-2xl">{editingService ? 'Editar' : 'Nuevo'} Servicio</CardTitle>
            <CardDescription className="text-sm">
              {editingService ? 'Actualiza la información del servicio' : 'Agrega un nuevo servicio'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del servicio *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Netflix, Internet, Luz"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Método de pago *</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(value) => setFormData({ ...formData, paymentMethod: value as PaymentMethod })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona método de pago" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Transferencia/Efectivo</SelectItem>
                    <SelectItem value="card">Tarjeta de Crédito</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Indica cómo pagas normalmente este servicio
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceType">Tipo de servicio *</Label>
                <Select
                  value={formData.serviceType}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    serviceType: value as ServiceType,
                    // Limpiar campos de ciclo si cambia a fijo
                    billingCycleDay: value === 'fixed' ? undefined : formData.billingCycleDay,
                    billingDueDay: value === 'fixed' ? undefined : formData.billingDueDay,
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo de servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Monto fijo recurrente</SelectItem>
                    <SelectItem value="billing_cycle">Con ciclo de facturación</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.serviceType === 'billing_cycle'
                    ? 'Como CFE o agua: el monto varía y se conoce al llegar el recibo'
                    : 'Como Netflix: el monto es siempre el mismo'}
                </p>
              </div>

              {/* Ciclo de facturación para billing_cycle */}
              {formData.serviceType === 'billing_cycle' && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg border border-muted">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Ciclo de Facturación</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configura las fechas de corte y vencimiento del servicio
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="billingCycleDay">Día de corte</Label>
                      <Input
                        id="billingCycleDay"
                        type="number"
                        min={1}
                        max={31}
                        value={formData.billingCycleDay || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          billingCycleDay: e.target.value ? parseInt(e.target.value) : undefined,
                        })}
                        placeholder="1-31"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billingDueDay">Día de vencimiento</Label>
                      <Input
                        id="billingDueDay"
                        type="number"
                        min={1}
                        max={31}
                        value={formData.billingDueDay || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          billingDueDay: e.target.value ? parseInt(e.target.value) : undefined,
                        })}
                        placeholder="1-31"
                      />
                    </div>
                  </div>

                  {/* Líneas opcionales - solo para servicios multi-contrato */}
                  {editingService && (
                    <div className="pt-4 border-t">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                        <Cable className="h-4 w-4" />
                        <span>Líneas adicionales (opcional)</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Solo si tienes múltiples contratos con diferentes ciclos (ej: telefonía)
                      </p>
                      <ServiceLineList
                        service={editingService}
                        onLinesChange={refetchServiceLines}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm} className="w-full sm:w-auto" disabled={saving}>
                  Cancelar
                </Button>
                <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    editingService ? 'Actualizar' : 'Guardar'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search and Filter */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar servicios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sortBy} onValueChange={(value: 'name' | 'method') => setSortBy(value)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Ordenar por nombre</SelectItem>
                <SelectItem value="method">Ordenar por método</SelectItem>
              </SelectContent>
            </Select>
            <ViewToggle value={viewMode} onChange={handleViewModeChange} />
          </div>
          {searchTerm && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {filteredAndSortedServices.length} de {services.length} servicios
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm('')}
                className="h-auto p-1"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty State */}
      {filteredAndSortedServices.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Store className="h-12 w-12 text-muted-foreground mb-4" />
            {services.length === 0 ? (
              <>
                <p className="text-muted-foreground">No hay servicios registrados</p>
                <p className="text-sm text-muted-foreground">Haz clic en "Nuevo Servicio" para agregar uno</p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">No se encontraron servicios</p>
                <p className="text-sm text-muted-foreground">Intenta con otros términos de búsqueda</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vista Grid */}
      {filteredAndSortedServices.length > 0 && viewMode === 'grid' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedServices.map((service) => (
            <ServiceGridItem
              key={service.id}
              service={service}
              linesCount={linesCountByService[service.id]}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Vista Lista */}
      {filteredAndSortedServices.length > 0 && viewMode === 'list' && (
        <div className="space-y-2">
          {filteredAndSortedServices.map((service) => (
            <ServiceListItem
              key={service.id}
              service={service}
              linesCount={linesCountByService[service.id]}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Botón flotante fijo - Solo en móvil */}
      <Button
        onClick={() => setShowForm(!showForm)}
        className="sm:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        {showForm ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </Button>

      {/* Sheet para ver detalles del servicio */}
      <Sheet open={!!viewingService} onOpenChange={() => setViewingService(null)}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          {viewingService && (
            <>
              <SheetHeader className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <Store className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <SheetTitle className="text-lg">{viewingService.name}</SheetTitle>
                    <SheetDescription>Detalles del servicio</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-6 py-6 flex-1 overflow-y-auto">
                {/* Tipo de servicio */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Tipo de Servicio</h4>
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                    {viewingService.serviceType === 'billing_cycle' ? (
                      <CalendarCheck className="h-5 w-5 text-orange-600" />
                    ) : (
                      <Store className="h-5 w-5 text-primary" />
                    )}
                    <span className="font-medium">
                      {viewingService.serviceType === 'billing_cycle' ? 'Con ciclo de facturación' : 'Monto fijo recurrente'}
                    </span>
                  </div>
                </div>

                {/* Ciclo de facturación (solo para billing_cycle) */}
                {viewingService.serviceType === 'billing_cycle' &&
                 viewingService.billingCycleDay &&
                 viewingService.billingDueDay && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Ciclo de Facturación</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground mb-1">Día de corte</p>
                        <p className="text-2xl font-bold text-orange-600">{viewingService.billingCycleDay}</p>
                      </div>
                      <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground mb-1">Día de vencimiento</p>
                        <p className="text-2xl font-bold text-red-600">{viewingService.billingDueDay}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Líneas adicionales (solo para billing_cycle con líneas) */}
                {viewingService.serviceType === 'billing_cycle' &&
                 linesCountByService[viewingService.id] > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Líneas / Contratos</h4>
                    <ServiceLineList
                      service={viewingService}
                      onLinesChange={refetchServiceLines}
                    />
                  </div>
                )}

                {/* Método de pago */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Método de Pago</h4>
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                    {viewingService.paymentMethod === 'card' ? (
                      <CreditCard className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Banknote className="h-5 w-5 text-green-600" />
                    )}
                    <span className="font-medium">
                      {viewingService.paymentMethod === 'card' ? 'Tarjeta de Crédito' : 'Transferencia/Efectivo'}
                    </span>
                  </div>
                </div>

                {/* Información de creación */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Información</h4>
                  <div className="grid gap-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Creado por</span>
                      <span className="font-medium">{viewingService.createdByName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Fecha de creación</span>
                      <span className="font-medium">
                        {viewingService.createdAt.toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    {viewingService.updatedByName !== viewingService.createdByName && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Última modificación</span>
                        <span className="font-medium">{viewingService.updatedByName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Historial de pagos para servicios con billing_cycle */}
                {viewingService.serviceType === 'billing_cycle' && (
                  <ServiceBillingHistory
                    service={viewingService}
                    instances={paymentInstances}
                  />
                )}
              </div>

              <SheetFooter>
                <Button onClick={handleEditFromView} className="w-full">
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Servicio
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
