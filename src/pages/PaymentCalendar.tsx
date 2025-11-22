import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
  arrayUnion,
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
import { Progress } from '@/components/ui/progress';
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
  PartialPayment,
} from '@/lib/types';
import {
  Calendar,
  CreditCard,
  Store,
  Check,
  X,
  Edit,
  Banknote,
  CalendarRange,
  RotateCcw,
  Plus,
  Trash2,
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
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [partialNotes, setPartialNotes] = useState('');

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
        where('householdId', '==', currentUser.householdId)
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

  /**
   * Actualiza el crédito disponible de una tarjeta cuando se efectúa un pago
   * @param cardId - ID de la tarjeta a actualizar
   * @param amount - Monto del pago
   * @param operation - 'add' para sumar al disponible, 'subtract' para restar
   */
  const updateCardAvailableCredit = async (
    cardId: string,
    amount: number,
    operation: 'add' | 'subtract'
  ) => {
    if (!currentUser) return;

    try {
      const cardRef = doc(db, 'cards', cardId);
      const cardSnap = await getDoc(cardRef);

      if (!cardSnap.exists()) {
        console.error('Card not found:', cardId);
        return;
      }

      const cardData = cardSnap.data() as CardType;
      const currentAvailable = cardData.availableCredit || 0;
      const creditLimit = cardData.creditLimit || 0;

      // Calcular nuevo disponible
      const newAvailableCredit = operation === 'add'
        ? currentAvailable + amount
        : currentAvailable - amount;

      // Calcular nuevo balance (límite - disponible)
      const newCurrentBalance = creditLimit - newAvailableCredit;

      await updateDoc(cardRef, {
        availableCredit: newAvailableCredit,
        currentBalance: newCurrentBalance,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.id,
        updatedByName: currentUser.name,
      });

      // Actualizar estado local de tarjetas
      setCards(prevCards =>
        prevCards.map(card =>
          card.id === cardId
            ? { ...card, availableCredit: newAvailableCredit, currentBalance: newCurrentBalance }
            : card
        )
      );
    } catch (error) {
      console.error('Error updating card available credit:', error);
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
        where('householdId', '==', currentUser.householdId),
        where('dueDate', '>=', Timestamp.fromDate(currentMonthStart))
      );

      const snapshot = await getDocs(instancesQuery);
      let instancesData = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        dueDate: doc.data().dueDate?.toDate() || new Date(),
        paidDate: doc.data().paidDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as PaymentInstance[];

      // Filtrar por rango superior en el cliente
      instancesData = instancesData.filter(
        (instance) => instance.dueDate <= nextMonthEnd
      );

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
        // Desde el primer día hasta el último día del mes actual
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        return { start: startOfMonth, end: endOfMonth };
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
   * Obtiene el número de semana del año para una fecha dada (ISO 8601)
   */
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
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
    const weekNum = getWeekNumber(dateRange.start);

    // Incluir número de semana para filtros de semana
    if (timeFilter === 'this_week' || timeFilter === 'next_week') {
      return `Semana ${weekNum} · ${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`;
    }

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

    // Filtro de estado - incluir 'partial' en pendientes
    if (showPendingOnly) {
      filtered = filtered.filter((instance) => instance.status === 'pending' || instance.status === 'partial');
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

      // Para pagos parciales, usar remainingAmount; para otros, usar amount
      const amountToPay = instance.status === 'partial' && instance.remainingAmount !== undefined
        ? instance.remainingAmount
        : instance.amount;

      group.totalAmount += amountToPay;

      // Calcular si es transferencia o tarjeta
      if (instance.paymentType === 'card_payment') {
        group.totalTransfer += amountToPay;
      } else if (instance.serviceId) {
        const service = services.find((s) => s.id === instance.serviceId);
        if (service?.paymentMethod === 'card') {
          group.totalCard += amountToPay;
        } else {
          group.totalTransfer += amountToPay;
        }
      }
    });

    return Array.from(groups.values());
  };

  const handleMarkAsPaid = async (instance: PaymentInstance) => {
    if (!currentUser) return;

    try {
      // Calcular el monto que se está pagando ahora
      // Si hay pagos parciales, solo pagar lo restante; si no, pagar el monto completo
      const amountBeingPaid = instance.remainingAmount ?? instance.amount;

      await updateDoc(doc(db, 'payment_instances', instance.id), {
        status: 'paid',
        paidDate: serverTimestamp(),
        paidAmount: instance.amount,
        remainingAmount: 0,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.id,
        updatedByName: currentUser.name,
      });

      // Si es un pago a tarjeta, actualizar el disponible
      if (instance.paymentType === 'card_payment' && instance.cardId) {
        await updateCardAvailableCredit(instance.cardId, amountBeingPaid, 'add');
      }

      toast.success('Pago marcado como realizado');
      await fetchInstances();
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('Error al marcar como pagado');
    }
  };

  const handleCancelPayment = async (instance: PaymentInstance) => {
    if (!currentUser) return;
    if (!confirm('¿Estás seguro de cancelar este pago?')) return;

    try {
      await updateDoc(doc(db, 'payment_instances', instance.id), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.id,
        updatedByName: currentUser.name,
      });

      toast.success('Pago cancelado');
      await fetchInstances();
    } catch (error) {
      console.error('Error cancelling payment:', error);
      toast.error('Error al cancelar el pago');
    }
  };

  const handleUnmarkAsPaid = async (instance: PaymentInstance) => {
    if (!currentUser) return;
    if (!confirm('¿Estás seguro de desmarcar este pago como realizado?')) return;

    try {
      // Verificar si hay pagos parciales
      const hasPartialPayments = instance.partialPayments && instance.partialPayments.length > 0;

      // Calcular el monto que se había pagado al completar (lo que no eran pagos parciales)
      const partialPaymentsTotal = hasPartialPayments
        ? instance.partialPayments!.reduce((sum, p) => sum + p.amount, 0)
        : 0;
      const amountToRevert = instance.amount - partialPaymentsTotal;

      if (hasPartialPayments) {
        // Si hay pagos parciales, calcular el monto pagado
        const totalPaid = instance.partialPayments!.reduce((sum, p) => sum + p.amount, 0);
        const remaining = instance.amount - totalPaid;

        await updateDoc(doc(db, 'payment_instances', instance.id), {
          status: 'partial',
          paidDate: null,
          paidAmount: totalPaid,
          remainingAmount: remaining,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.id,
          updatedByName: currentUser.name,
        });
        toast.success('Pago marcado como parcial');
      } else {
        // Si no hay pagos parciales, marcar como pendiente
        await updateDoc(doc(db, 'payment_instances', instance.id), {
          status: 'pending',
          paidDate: null,
          paidAmount: null,
          remainingAmount: instance.amount,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.id,
          updatedByName: currentUser.name,
        });
        toast.success('Pago marcado como pendiente');
      }

      // Si es un pago a tarjeta, revertir el disponible (restar lo que se había sumado)
      if (instance.paymentType === 'card_payment' && instance.cardId && amountToRevert > 0) {
        await updateCardAvailableCredit(instance.cardId, amountToRevert, 'subtract');
      }

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
    if (!currentUser) return;
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
        updatedBy: currentUser.id,
        updatedByName: currentUser.name,
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

  // Funciones de Pago Parcial
  const handleOpenPartialPayment = (instance: PaymentInstance) => {
    setEditingInstance(instance);
    setPartialAmount('');
    setPartialNotes('');
    setShowPartialPaymentModal(true);
  };

  const handleSavePartialPayment = async () => {
    if (!currentUser) return;
    if (!editingInstance) return;

    const amountToPay = parseCurrencyInput(partialAmount);
    if (amountToPay <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    const currentRemaining = editingInstance.remainingAmount ?? editingInstance.amount;
    const currentPaid = editingInstance.paidAmount ?? 0;

    if (amountToPay > currentRemaining) {
      toast.error(`El monto excede lo pendiente (${formatCurrency(currentRemaining)})`);
      return;
    }

    try {
      // Crear registro de pago parcial con fecha actual (milliseconds)
      const newPartialPayment: PartialPayment = {
        id: crypto.randomUUID(),
        amount: amountToPay,
        paidDate: Date.now(),
        notes: partialNotes || undefined,
        paidBy: currentUser.id,
        paidByName: currentUser.name,
      };

      // Calcular nuevos valores
      const newPaidAmount = currentPaid + amountToPay;
      const newRemainingAmount = editingInstance.amount - newPaidAmount;
      const isFullyPaid = newRemainingAmount === 0;

      // Actualizar en Firestore
      await updateDoc(doc(db, 'payment_instances', editingInstance.id), {
        status: isFullyPaid ? 'paid' : 'partial',
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        partialPayments: arrayUnion(newPartialPayment),
        paidDate: isFullyPaid ? serverTimestamp() : editingInstance.paidDate || null,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.id,
        updatedByName: currentUser.name,
      });

      // Si es un pago a tarjeta, actualizar el disponible
      if (editingInstance.paymentType === 'card_payment' && editingInstance.cardId) {
        await updateCardAvailableCredit(editingInstance.cardId, amountToPay, 'add');
      }

      toast.success(
        isFullyPaid
          ? 'Pago completado'
          : `Pago parcial registrado: ${formatCurrency(amountToPay)}`
      );

      setShowPartialPaymentModal(false);
      setEditingInstance(null);
      setPartialAmount('');
      setPartialNotes('');
      await fetchInstances();
    } catch (error) {
      console.error('Error saving partial payment:', error);
      toast.error('Error al registrar el pago parcial');
    }
  };

  const handleDeletePartialPayment = async (instance: PaymentInstance, paymentId: string) => {
    if (!currentUser) return;
    if (!confirm('¿Eliminar este pago parcial?')) return;

    const partialPayments = instance.partialPayments || [];
    const payment = partialPayments.find(p => p.id === paymentId);
    if (!payment) return;

    try {
      // Filtrar el array de pagos parciales y asegurar formato correcto
      const updatedPartialPayments = partialPayments
        .filter(p => p.id !== paymentId)
        .map(p => {
          const cleanPayment: any = {
            id: p.id,
            amount: p.amount,
            paidDate: typeof p.paidDate === 'number' ? p.paidDate : Date.now(),
            paidBy: p.paidBy,
            paidByName: p.paidByName,
          };
          // Solo agregar notes si no es undefined
          if (p.notes !== undefined) {
            cleanPayment.notes = p.notes;
          }
          return cleanPayment;
        });

      const newPaidAmount = (instance.paidAmount || 0) - payment.amount;
      const newRemainingAmount = instance.amount - newPaidAmount;

      // Actualizar el documento con el array filtrado
      const docRef = doc(db, 'payment_instances', instance.id);
      await updateDoc(docRef, {
        status: newPaidAmount === 0 ? 'pending' : 'partial',
        paidAmount: newPaidAmount === 0 ? null : newPaidAmount,
        remainingAmount: newRemainingAmount,
        partialPayments: updatedPartialPayments,
        paidDate: newPaidAmount === 0 ? null : instance.paidDate,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.id,
        updatedByName: currentUser.name,
      });

      // Si es un pago a tarjeta, revertir el disponible (restar el monto del pago eliminado)
      if (instance.paymentType === 'card_payment' && instance.cardId) {
        await updateCardAvailableCredit(instance.cardId, payment.amount, 'subtract');
      }

      toast.success('Pago parcial eliminado');
      await fetchInstances();
    } catch (error: any) {
      console.error('Error deleting partial payment:', error);

      // Si es un error de invalid-argument (formato antiguo con Timestamp),
      // limpiamos todo el array de partialPayments
      if (error?.code === 'invalid-argument') {
        try {
          const docRef = doc(db, 'payment_instances', instance.id);
          await updateDoc(docRef, {
            status: 'pending',
            paidAmount: null,
            remainingAmount: instance.amount,
            partialPayments: [], // Limpiar array completo
            paidDate: null,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.id,
            updatedByName: currentUser.name,
          });

          // También revertir el disponible si es tarjeta (revertir todos los pagos parciales)
          if (instance.paymentType === 'card_payment' && instance.cardId && instance.paidAmount) {
            await updateCardAvailableCredit(instance.cardId, instance.paidAmount, 'subtract');
          }

          toast.success('Pagos parciales limpiados (formato antiguo incompatible)');
          await fetchInstances();
          return;
        } catch (cleanupError) {
          console.error('Error cleaning up partial payments:', cleanupError);
        }
      }

      toast.error('Error al eliminar el pago parcial');
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
      partial: { variant: 'default', label: 'Parcial' },
      paid: { variant: 'secondary', label: 'Pagado' },
      overdue: { variant: 'destructive', label: 'Vencido' },
      cancelled: { variant: 'secondary', label: 'Cancelado' },
    };

    const config = variants[status];
    return <Badge variant={config.variant} className={status === 'partial' ? 'bg-blue-600 hover:bg-blue-700' : ''}>{config.label}</Badge>;
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Calendario de Pagos</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Vista de tus próximos pagos programados</p>
        </div>
        <Calendar className="h-8 w-8 text-primary flex-shrink-0" />
      </div>

      {/* Filtros compactos */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {/* Filtro de período */}
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Período:</span>
              <Select value={timeFilter} onValueChange={(value) => setTimeFilter(value as TimeFilter)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="this_week">Esta semana</SelectItem>
                  <SelectItem value="next_week">Próxima semana</SelectItem>
                  <SelectItem value="this_month">Este mes</SelectItem>
                  <SelectItem value="next_month">Próximo mes</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Rango de fechas */}
            {timeFilter !== 'all' && timeFilter !== 'custom' && (
              <span className="text-sm text-muted-foreground">{getDateRangeDescription()}</span>
            )}

            {/* Filtro de pendientes */}
            <div className="flex items-center gap-2 sm:ml-auto">
              <Switch
                id="pending-filter"
                checked={showPendingOnly}
                onCheckedChange={setShowPendingOnly}
              />
              <Label htmlFor="pending-filter" className="text-sm cursor-pointer">
                Solo pendientes
              </Label>
            </div>

            {/* Botón reset */}
            {hasNonDefaultFilters() && (
              <Button variant="ghost" size="sm" onClick={handleResetFilters} className="h-8 px-2">
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Rango personalizado */}
          {timeFilter === 'custom' && (
            <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 space-y-1">
                <Label htmlFor="start-date" className="text-xs">Desde</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={customStartDate ? customStartDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => setCustomStartDate(e.target.value ? new Date(e.target.value) : null)}
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="end-date" className="text-xs">Hasta</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={customEndDate ? customEndDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => setCustomEndDate(e.target.value ? new Date(e.target.value) : null)}
                  min={customStartDate ? customStartDate.toISOString().split('T')[0] : ''}
                />
              </div>
              {customStartDate && customEndDate && (
                <span className="text-sm text-muted-foreground whitespace-nowrap">{getDateRangeDescription()}</span>
              )}
            </div>
          )}
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

            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdjustModal(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button onClick={handleSaveAdjustment} className="w-full sm:w-auto">
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Partial Payment Modal */}
      {showPartialPaymentModal && editingInstance && (
        <Card className="border-blue-600 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-500/10 to-transparent">
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Registrar Pago Parcial
            </CardTitle>
            <CardDescription>{editingInstance.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* Información del pago */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Monto total:</span>
                <span className="font-semibold">{formatCurrency(editingInstance.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pagado hasta ahora:</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(editingInstance.paidAmount || 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Restante:</span>
                <span className="font-semibold text-blue-600">
                  {formatCurrency(editingInstance.remainingAmount ?? editingInstance.amount)}
                </span>
              </div>

              {/* Progress bar */}
              {(editingInstance.paidAmount || 0) > 0 && (
                <div className="mt-3">
                  <Progress
                    value={((editingInstance.paidAmount || 0) / editingInstance.amount) * 100}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    {Math.round(((editingInstance.paidAmount || 0) / editingInstance.amount) * 100)}% completado
                  </p>
                </div>
              )}
            </div>

            {/* Form */}
            <div className="space-y-2">
              <Label htmlFor="partialAmount">Monto a abonar *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                  $
                </span>
                <Input
                  id="partialAmount"
                  type="text"
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  onFocus={(e) => setTimeout(() => e.target.select(), 0)}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Máximo: {formatCurrency(editingInstance.remainingAmount ?? editingInstance.amount)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="partialNotes">Notas (opcional)</Label>
              <Input
                id="partialNotes"
                value={partialNotes}
                onChange={(e) => setPartialNotes(e.target.value)}
                placeholder="Ej: Primer abono"
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPartialPaymentModal(false);
                  setEditingInstance(null);
                }}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button onClick={handleSavePartialPayment} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-1" />
                Registrar Abono
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
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl sm:text-2xl capitalize">
                    {group.month} {group.year}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {group.instances.length} pago{group.instances.length !== 1 ? 's' : ''} programado{group.instances.length !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto">
                  <p className="text-xl sm:text-2xl font-bold">{formatCurrency(group.totalAmount)}</p>
                  <div className="flex gap-3 sm:gap-4 mt-2 text-xs sm:text-sm">
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
                      } ${instance.status === 'cancelled' ? 'bg-muted/30 opacity-50' : ''} ${
                        instance.status === 'partial' ? 'border-blue-400 bg-blue-50/30' : ''
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                        <div className="flex-1 w-full sm:w-auto">
                          <div className="flex items-center gap-3">
                            <Icon className="h-5 w-5 text-primary flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-base sm:text-lg break-words">{instance.description}</h3>
                              <p className="text-xs sm:text-sm text-muted-foreground break-words">
                                {instance.paymentType === 'card_payment'
                                  ? `Tarjeta: ${getCardName(instance.cardId || '')}`
                                  : `Servicio: ${getServiceName(instance.serviceId || '')}`}
                              </p>
                              {instance.notes && (
                                <p className="text-xs text-muted-foreground italic mt-1 break-words">
                                  📝 {instance.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Progress bar para pagos parciales */}
                          {instance.status === 'partial' && (instance.paidAmount || 0) > 0 && (
                            <div className="mt-3 bg-white rounded-lg p-3 border border-blue-200">
                              <div className="flex justify-between text-xs mb-2">
                                <span className="text-muted-foreground">Progreso del pago</span>
                                <span className="font-semibold text-blue-600">
                                  {Math.round(((instance.paidAmount || 0) / instance.amount) * 100)}%
                                </span>
                              </div>
                              <Progress
                                value={((instance.paidAmount || 0) / instance.amount) * 100}
                                className="h-2 mb-2"
                              />
                              <div className="flex justify-between text-xs">
                                <span className="text-green-600 font-medium">
                                  Pagado: {formatCurrency(instance.paidAmount || 0)}
                                </span>
                                <span className="text-blue-600 font-medium">
                                  Restante: {formatCurrency(instance.remainingAmount || 0)}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Historial de pagos parciales */}
                          {instance.partialPayments && instance.partialPayments.length > 0 && (
                            <div className="mt-3 bg-muted/30 rounded-lg p-3 border">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold">Historial de abonos</span>
                                <Badge variant="secondary" className="text-xs">
                                  {instance.partialPayments.length}
                                </Badge>
                              </div>
                              <div className="space-y-2">
                                {instance.partialPayments.map((payment) => (
                                  <div
                                    key={payment.id}
                                    className="flex items-center justify-between text-xs bg-white rounded p-2 border"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-green-600">
                                        {formatCurrency(payment.amount)}
                                      </p>
                                      <p className="text-muted-foreground text-xs">
                                        {new Date(payment.paidDate).toLocaleDateString('es-ES')}{' '}
                                        • {payment.paidByName}
                                      </p>
                                      {payment.notes && (
                                        <p className="text-muted-foreground italic text-xs mt-1">
                                          {payment.notes}
                                        </p>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeletePartialPayment(instance, payment.id)}
                                      className="h-6 w-6 p-0 ml-2 flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                              <p className="text-xs sm:text-sm text-muted-foreground">Fecha</p>
                              <p className="font-semibold text-sm sm:text-base">
                                {instance.dueDate.toLocaleDateString('es-ES')}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs sm:text-sm text-muted-foreground">Monto</p>
                              <p className="font-semibold text-sm sm:text-base">{formatCurrency(instance.amount)}</p>
                            </div>
                            <div>
                              <p className="text-xs sm:text-sm text-muted-foreground">Método de pago</p>
                              <div className="flex items-center gap-1">
                                {isPaidByCard || instance.paymentType === 'card_payment' ? (
                                  instance.paymentType === 'card_payment' ? (
                                    <>
                                      <Banknote className="h-4 w-4 text-green-600" />
                                      <span className="text-xs sm:text-sm font-semibold text-green-600">Transferencia</span>
                                    </>
                                  ) : (
                                    <>
                                      <CreditCard className="h-4 w-4 text-blue-600" />
                                      <span className="text-xs sm:text-sm font-semibold text-blue-600">Tarjeta</span>
                                    </>
                                  )
                                ) : (
                                  <>
                                    <Banknote className="h-4 w-4 text-green-600" />
                                    <span className="text-xs sm:text-sm font-semibold text-green-600">Transferencia</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs sm:text-sm text-muted-foreground">Estado</p>
                              {getStatusBadge(instance.status)}
                            </div>
                          </div>
                        </div>

                        {(instance.status === 'pending' || instance.status === 'paid' || instance.status === 'partial') && (
                          <div className="flex sm:flex-col gap-2 w-full sm:w-auto sm:ml-4">
                            {instance.status === 'pending' ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMarkAsPaid(instance)}
                                  className="flex-1 sm:flex-none min-h-[44px] text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Pagado
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenPartialPayment(instance)}
                                  className="flex-1 sm:flex-none min-h-[44px] text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Parcial
                                </Button>
                              </>
                            ) : instance.status === 'partial' ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenPartialPayment(instance)}
                                  className="flex-1 sm:flex-none min-h-[44px] text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Abonar más
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMarkAsPaid(instance)}
                                  className="flex-1 sm:flex-none min-h-[44px] text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Completar
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnmarkAsPaid(instance)}
                                className="flex-1 sm:flex-none min-h-[44px] text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Desmarcar
                              </Button>
                            )}
                            {(instance.status === 'pending' || instance.status === 'partial') && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenAdjust(instance)}
                                  className="flex-1 sm:flex-none min-h-[44px]"
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Ajustar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelPayment(instance)}
                                  className="flex-1 sm:flex-none min-h-[44px] text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Cancelar
                                </Button>
                              </>
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
