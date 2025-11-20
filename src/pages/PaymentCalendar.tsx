import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useServices } from '@/hooks/useServices';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  formatCurrency,
  parseCurrencyInput,
} from '@/lib/utils';
import type {
  PaymentInstance,
  Card as CardType,
  PaymentStatus,
} from '@/lib/types';
import {
  Calendar,
  CreditCard,
  Store,
  Check,
  X,
  Edit,
  Banknote,
  Filter,
  CalendarDays,
  CalendarClock,
  CalendarRange,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

interface MonthGroup {
  month: string;
  year: number;
  instances: PaymentInstance[];
  totalAmount: number;
  totalTransfer: number;
  totalCard: number;
}

type TimeFilter = 'all' | 'this_week' | 'next_week' | 'this_month' | 'next_month' | 'custom';

export function PaymentCalendar() {
  const { currentUser } = useAuth();
  const { services } = useServices();
  const [instances, setInstances] = useState<PaymentInstance[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingInstance, setEditingInstance] = useState<PaymentInstance | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');

  // Filtros
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('this_week');
  const [showPendingOnly, setShowPendingOnly] = useState(true);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchInstances();
    fetchCards();
  }, [currentUser]);

  const fetchCards = async () => {
    if (!currentUser) return;

    try {
      const cardsQuery = query(
        collection(db, 'cards'),
        where('userId', '==', currentUser.id)
      );
      const snapshot = await getDocs(cardsQuery);
      const cardsData = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as CardType[];

      setCards(cardsData);
    } catch (error) {
      console.error('Error fetching cards:', error);
    }
  };

  const fetchInstances = async () => {
    if (!currentUser) return;

    try {
      // Obtener instancias del mes actual y siguiente
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);

      const instancesQuery = query(
        collection(db, 'payment_instances'),
        where('userId', '==', currentUser.id),
        where('dueDate', '>=', Timestamp.fromDate(currentMonthStart)),
        where('dueDate', '<=', Timestamp.fromDate(nextMonthEnd))
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

      // Ordenar por fecha
      instancesData.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

      setInstances(instancesData);
    } catch (error) {
      console.error('Error fetching instances:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calcula el rango de fechas según el filtro seleccionado
   */
  const getDateRange = (): { start: Date; end: Date } | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (timeFilter) {
      case 'all':
        return null; // Sin filtro de fecha

      case 'this_week': {
        // Desde hoy hasta el próximo lunes inclusive
        const nextMonday = new Date(today);
        const currentDay = today.getDay();
        const daysUntilMonday = currentDay === 0 ? 1 : currentDay === 1 ? 7 : (8 - currentDay);
        nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
        nextMonday.setHours(23, 59, 59, 999);
        return { start: today, end: nextMonday };
      }

      case 'next_week': {
        // Desde el próximo lunes hasta el domingo siguiente
        const currentDay = today.getDay();
        const daysUntilNextMonday = currentDay === 0 ? 1 : currentDay === 1 ? 7 : (8 - currentDay);
        const nextMonday = new Date(today);
        nextMonday.setDate(nextMonday.getDate() + daysUntilNextMonday);
        nextMonday.setHours(0, 0, 0, 0);

        const nextSunday = new Date(nextMonday);
        nextSunday.setDate(nextSunday.getDate() + 6);
        nextSunday.setHours(23, 59, 59, 999);

        return { start: nextMonday, end: nextSunday };
      }

      case 'this_month': {
        // Desde hoy hasta el último día del mes actual
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        return { start: today, end: endOfMonth };
      }

      case 'next_month': {
        // Primer día del próximo mes hasta el último día del próximo mes
        const firstDayNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        firstDayNextMonth.setHours(0, 0, 0, 0);

        const lastDayNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        lastDayNextMonth.setHours(23, 59, 59, 999);

        return { start: firstDayNextMonth, end: lastDayNextMonth };
      }

      case 'custom': {
        // Rango personalizado
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }
        return null;
      }

      default:
        return null;
    }
  };

  /**
   * Obtiene la descripción del rango de fechas según el filtro seleccionado
   */
  const getDateRangeDescription = (): string => {
    const dateRange = getDateRange();
    if (!dateRange || timeFilter === 'all') {
      return 'Mostrando todos los pagos';
    }

    const formatDate = (date: Date) => date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

    return `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`;
  };

  /**
   * Resetea todos los filtros a sus valores por defecto
   */
  const handleResetFilters = () => {
    setTimeFilter('this_week');
    setShowPendingOnly(true);
    setCustomStartDate(null);
    setCustomEndDate(null);
  };

  /**
   * Verifica si hay filtros no-default activos
   */
  const hasNonDefaultFilters = (): boolean => {
    return timeFilter !== 'this_week' || !showPendingOnly;
  };

  /**
   * Filtra las instancias según los filtros seleccionados
   */
  const getFilteredInstances = (): PaymentInstance[] => {
    let filtered = [...instances];

    // Filtro de tiempo
    const dateRange = getDateRange();
    if (dateRange) {
      const { start, end } = dateRange;
      filtered = filtered.filter(
        (instance) => instance.dueDate >= start && instance.dueDate <= end
      );
    }

    // Filtro de estado
    if (showPendingOnly) {
      filtered = filtered.filter((instance) => instance.status === 'pending');
    }

    return filtered;
  };

  const groupByMonth = (): MonthGroup[] => {
    const groups = new Map<string, MonthGroup>();

    const filteredInstances = getFilteredInstances();
    filteredInstances.forEach((instance) => {
      const month = instance.dueDate.toLocaleString('es-ES', { month: 'long' });
      const year = instance.dueDate.getFullYear();
      const key = `${month}-${year}`;

      if (!groups.has(key)) {
        groups.set(key, {
          month,
          year,
          instances: [],
          totalAmount: 0,
          totalTransfer: 0,
          totalCard: 0,
        });
      }

      const group = groups.get(key)!;
      group.instances.push(instance);
      group.totalAmount += instance.amount;

      // Calcular si es transferencia o tarjeta
      if (instance.paymentType === 'card_payment') {
        group.totalTransfer += instance.amount;
      } else if (instance.serviceId) {
        const service = services.find((s) => s.id === instance.serviceId);
        if (service?.paymentMethod === 'card') {
          group.totalCard += instance.amount;
        } else {
          group.totalTransfer += instance.amount;
        }
      }
    });

    return Array.from(groups.values());
  };

  const handleMarkAsPaid = async (instance: PaymentInstance) => {
    try {
      await updateDoc(doc(db, 'payment_instances', instance.id), {
        status: 'paid',
        paidDate: serverTimestamp(),
        paidAmount: instance.amount,
        updatedAt: serverTimestamp(),
      });

      toast.success('Pago marcado como realizado');
      await fetchInstances();
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('Error al marcar como pagado');
    }
  };

  const handleCancelPayment = async (instance: PaymentInstance) => {
    if (!confirm('¿Estás seguro de cancelar este pago?')) return;

    try {
      await updateDoc(doc(db, 'payment_instances', instance.id), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });

      toast.success('Pago cancelado');
      await fetchInstances();
    } catch (error) {
      console.error('Error cancelling payment:', error);
      toast.error('Error al cancelar el pago');
    }
  };

  const handleUnmarkAsPaid = async (instance: PaymentInstance) => {
    if (!confirm('¿Estás seguro de desmarcar este pago como realizado?')) return;

    try {
      await updateDoc(doc(db, 'payment_instances', instance.id), {
        status: 'pending',
        paidDate: null,
        paidAmount: null,
        updatedAt: serverTimestamp(),
      });

      toast.success('Pago marcado como pendiente');
      await fetchInstances();
    } catch (error) {
      console.error('Error unmarking as paid:', error);
      toast.error('Error al desmarcar como pagado');
    }
  };

  const handleOpenAdjust = (instance: PaymentInstance) => {
    setEditingInstance(instance);
    setAdjustAmount(instance.amount.toString());
    setAdjustNotes(instance.notes || '');
    setShowAdjustModal(true);
  };

  const handleSaveAdjustment = async () => {
    if (!editingInstance) return;

    const newAmount = parseCurrencyInput(adjustAmount);
    if (newAmount <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    try {
      await updateDoc(doc(db, 'payment_instances', editingInstance.id), {
        amount: newAmount,
        notes: adjustNotes || null,
        updatedAt: serverTimestamp(),
      });

      toast.success('Monto ajustado correctamente');
      setShowAdjustModal(false);
      setEditingInstance(null);
      await fetchInstances();
    } catch (error) {
      console.error('Error adjusting amount:', error);
      toast.error('Error al ajustar el monto');
    }
  };

  const getCardName = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    return card?.name || 'Tarjeta no encontrada';
  };

  const getServiceName = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    return service?.name || 'Servicio no encontrado';
  };

  const getServicePaymentMethod = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    return service?.paymentMethod || 'transfer';
  };

  const getStatusBadge = (status: PaymentStatus) => {
    const variants: Record<PaymentStatus, { variant: 'default' | 'secondary' | 'destructive', label: string }> = {
      pending: { variant: 'default', label: 'Pendiente' },
      paid: { variant: 'secondary', label: 'Pagado' },
      overdue: { variant: 'destructive', label: 'Vencido' },
      cancelled: { variant: 'secondary', label: 'Cancelado' },
    };

    const config = variants[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const monthGroups = groupByMonth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Calendario de Pagos</h2>
          <p className="text-muted-foreground">Vista de tus próximos pagos programados</p>
        </div>
        <Calendar className="h-8 w-8 text-primary" />
      </div>

      {/* Filtros */}
      <Card className="border-2">
        <CardContent className="pt-6 pb-6">
          <div className="space-y-4">
            {/* Header con botón de reset */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                <span className="text-base font-semibold">Filtros</span>
              </div>
              {hasNonDefaultFilters() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Resetear
                </Button>
              )}
            </div>

            {/* Filtros principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Filtro de período */}
              <div className="space-y-2">
                <Label htmlFor="time-filter" className="text-sm font-medium flex items-center gap-2">
                  <CalendarRange className="h-4 w-4" />
                  Período
                </Label>
                <Select value={timeFilter} onValueChange={(value) => setTimeFilter(value as TimeFilter)}>
                  <SelectTrigger id="time-filter" className="w-full">
                    <SelectValue placeholder="Seleccionar período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">📅 Todos</SelectItem>
                    <SelectItem value="this_week">📆 Esta semana</SelectItem>
                    <SelectItem value="next_week">📅 Próxima semana</SelectItem>
                    <SelectItem value="this_month">📊 Este mes</SelectItem>
                    <SelectItem value="next_month">📊 Próximo mes</SelectItem>
                    <SelectItem value="custom">🔧 Rango específico</SelectItem>
                  </SelectContent>
                </Select>

                {/* Badge con rango de fechas */}
                {timeFilter !== 'all' && (
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs font-normal">
                      <CalendarClock className="h-3 w-3 mr-1" />
                      {getDateRangeDescription()}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Filtro de estado */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Estado
                </Label>
                <div className="flex items-center justify-between h-10 px-3 py-2 border rounded-md bg-background">
                  <Label htmlFor="pending-filter" className="text-sm font-normal cursor-pointer">
                    Solo pendientes
                  </Label>
                  <Switch
                    id="pending-filter"
                    checked={showPendingOnly}
                    onCheckedChange={setShowPendingOnly}
                  />
                </div>
                {showPendingOnly && (
                  <Badge variant="default" className="text-xs font-normal">
                    Mostrando solo pendientes
                  </Badge>
                )}
              </div>
            </div>

            {/* Rango personalizado */}
            {timeFilter === 'custom' && (
              <div className="p-4 bg-muted/50 rounded-lg border-2 border-primary/20 space-y-3">
                <p className="text-sm font-medium">Seleccionar rango personalizado</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="start-date" className="text-xs font-medium">
                      Fecha inicio
                    </Label>
                    <Input
                      id="start-date"
                      type="date"
                      className="w-full"
                      value={customStartDate ? customStartDate.toISOString().split('T')[0] : ''}
                      onChange={(e) => setCustomStartDate(e.target.value ? new Date(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-date" className="text-xs font-medium">
                      Fecha fin
                    </Label>
                    <Input
                      id="end-date"
                      type="date"
                      className="w-full"
                      value={customEndDate ? customEndDate.toISOString().split('T')[0] : ''}
                      onChange={(e) => setCustomEndDate(e.target.value ? new Date(e.target.value) : null)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Adjust Modal */}
      {showAdjustModal && editingInstance && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Ajustar Monto</CardTitle>
            <CardDescription>{editingInstance.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adjustAmount">Nuevo Monto *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                  $
                </span>
                <Input
                  id="adjustAmount"
                  type="text"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  onFocus={(e) => setTimeout(() => e.target.select(), 0)}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustNotes">Notas (opcional)</Label>
              <Input
                id="adjustNotes"
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="Ej: Faltó un día"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAdjustModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveAdjustment}>
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month Groups */}
      {monthGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay pagos programados</p>
            <p className="text-sm text-muted-foreground">Los pagos se generan automáticamente</p>
          </CardContent>
        </Card>
      ) : (
        monthGroups.map((group) => (
          <Card key={`${group.month}-${group.year}`}>
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl capitalize">
                    {group.month} {group.year}
                  </CardTitle>
                  <CardDescription>
                    {group.instances.length} pago{group.instances.length !== 1 ? 's' : ''} programado{group.instances.length !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{formatCurrency(group.totalAmount)}</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <div className="flex items-center gap-1">
                      <Banknote className="h-4 w-4 text-green-600" />
                      <span className="text-muted-foreground">{formatCurrency(group.totalTransfer)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CreditCard className="h-4 w-4 text-blue-600" />
                      <span className="text-muted-foreground">{formatCurrency(group.totalCard)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {group.instances.map((instance) => {
                  const Icon = instance.paymentType === 'card_payment' ? CreditCard : Store;
                  const isPaidByCard =
                    instance.paymentType === 'service_payment' &&
                    instance.serviceId &&
                    getServicePaymentMethod(instance.serviceId) === 'card';

                  return (
                    <div
                      key={instance.id}
                      className={`border rounded-lg p-4 transition-all ${
                        instance.status === 'paid' ? 'bg-muted/50 opacity-70' : ''
                      } ${instance.status === 'cancelled' ? 'bg-muted/30 opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <Icon className="h-5 w-5 text-primary" />
                            <div>
                              <h3 className="font-semibold">{instance.description}</h3>
                              <p className="text-sm text-muted-foreground">
                                {instance.paymentType === 'card_payment'
                                  ? `Tarjeta: ${getCardName(instance.cardId || '')}`
                                  : `Servicio: ${getServiceName(instance.serviceId || '')}`}
                              </p>
                              {instance.notes && (
                                <p className="text-xs text-muted-foreground italic mt-1">
                                  📝 {instance.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Fecha</p>
                              <p className="font-semibold text-sm">
                                {instance.dueDate.toLocaleDateString('es-ES')}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Monto</p>
                              <p className="font-semibold text-sm">{formatCurrency(instance.amount)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Método de pago</p>
                              <div className="flex items-center gap-1">
                                {isPaidByCard || instance.paymentType === 'card_payment' ? (
                                  instance.paymentType === 'card_payment' ? (
                                    <>
                                      <Banknote className="h-4 w-4 text-green-600" />
                                      <span className="text-sm font-semibold text-green-600">Transferencia</span>
                                    </>
                                  ) : (
                                    <>
                                      <CreditCard className="h-4 w-4 text-blue-600" />
                                      <span className="text-sm font-semibold text-blue-600">Tarjeta</span>
                                    </>
                                  )
                                ) : (
                                  <>
                                    <Banknote className="h-4 w-4 text-green-600" />
                                    <span className="text-sm font-semibold text-green-600">Transferencia</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Estado</p>
                              {getStatusBadge(instance.status)}
                            </div>
                          </div>
                        </div>

                        {(instance.status === 'pending' || instance.status === 'paid') && (
                          <div className="flex flex-col gap-2 ml-4">
                            {instance.status === 'pending' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsPaid(instance)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Pagado
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnmarkAsPaid(instance)}
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Desmarcar
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenAdjust(instance)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Ajustar
                            </Button>
                            {instance.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelPayment(instance)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <X className="h-4 w-4 mr-1" />
                                Cancelar
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
