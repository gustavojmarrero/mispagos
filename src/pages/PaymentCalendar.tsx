import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useServices } from '@/hooks/useServices';
import { useBanks } from '@/hooks/useBanks';
import { useServiceLines } from '@/hooks/useServiceLines';
import { analyzeServiceLineBillingCycles } from '@/lib/dashboardMetrics';
import { CardDetailSheet } from '@/components/cards/CardDetailSheet';
import { PaymentRow } from '@/components/payment/PaymentRow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  PartialPayment,
  ScheduledPayment,
} from '@/lib/types';
import {
  Calendar,
  CreditCard,
  X,
  Banknote,
  CalendarRange,
  Plus,
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
type PaymentTypeFilter = 'all' | 'card' | 'service';

// Parsear fecha de input type="date" como fecha local (no UTC)
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Formatear fecha para input type="date"
const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function PaymentCalendar() {
  const { currentUser } = useAuth();
  const { services } = useServices();
  const { banks } = useBanks();
  const { serviceLines: allServiceLines } = useServiceLines({ activeOnly: false });
  const [searchParams] = useSearchParams();
  const [instances, setInstances] = useState<PaymentInstance[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [scheduledPayments, setScheduledPayments] = useState<ScheduledPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingInstance, setEditingInstance] = useState<PaymentInstance | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [partialNotes, setPartialNotes] = useState('');
  const [viewingCard, setViewingCard] = useState<CardType | null>(null);
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());

  // Filtros
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('this_week');
  const [showPendingOnly, setShowPendingOnly] = useState(true);
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<PaymentTypeFilter>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchInstances();
    fetchCards();
    fetchScheduledPayments();
  }, [currentUser, timeFilter, customStartDate, customEndDate]);

  // Calcular estado del ciclo vigente para cada línea de servicio
  const lineStatusMap = useMemo(() => {
    if (allServiceLines.length === 0 || instances.length === 0) return {};

    const analysis = analyzeServiceLineBillingCycles(
      allServiceLines.filter(l => l.isActive),
      services,
      scheduledPayments,
      instances
    );

    return analysis.reduce((acc, item) => {
      acc[item.serviceLine.id] = item.currentPeriod.status;
      return acc;
    }, {} as Record<string, 'covered' | 'not_programmed' | 'overdue' | 'partial' | 'programmed'>);
  }, [allServiceLines, services, scheduledPayments, instances]);

  // Leer query params para filtro de fechas (navegación desde Reports)
  useEffect(() => {
    const startParam = searchParams.get('startDate');
    const endParam = searchParams.get('endDate');
    if (startParam && endParam) {
      // Usar parseLocalDate para evitar problemas de zona horaria UTC
      setCustomStartDate(parseLocalDate(startParam));
      setCustomEndDate(parseLocalDate(endParam));
      setTimeFilter('custom');
    }
  }, [searchParams]);

  // Abrir modal de ajuste automáticamente si viene instanceId en la URL (desde alertas del Dashboard)
  useEffect(() => {
    const instanceId = searchParams.get('instanceId');
    if (instanceId && instances.length > 0 && !loading) {
      const instance = instances.find(i => i.id === instanceId);
      if (instance) {
        setEditingInstance(instance);
        setAdjustAmount(instance.amount.toString());
        setAdjustNotes(instance.notes || '');
        setShowAdjustModal(true);
      }
    }
  }, [searchParams, instances, loading]);

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

  const fetchScheduledPayments = async () => {
    if (!currentUser) return;

    try {
      const paymentsQuery = query(
        collection(db, 'scheduled_payments'),
        where('householdId', '==', currentUser.householdId)
      );
      const snapshot = await getDocs(paymentsQuery);
      const paymentsData = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        paymentDate: doc.data().paymentDate?.toDate(),
      })) as ScheduledPayment[];

      setScheduledPayments(paymentsData);
    } catch (error) {
      console.error('Error fetching scheduled payments:', error);
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
      const cardDoc = await getDoc(cardRef);

      if (!cardDoc.exists()) {
        console.error('Card not found:', cardId);
        return;
      }

      const cardData = cardDoc.data();
      const currentAvailable = cardData.availableCredit || 0;
      const creditLimit = cardData.creditLimit || 0;

      // Calcular nuevo disponible
      const newAvailableCredit = operation === 'add'
        ? currentAvailable + amount
        : currentAvailable - amount;

      // Calcular nuevo saldo (límite - disponible)
      const newCurrentBalance = creditLimit - newAvailableCredit;

      // Actualizar en Firestore
      await updateDoc(cardRef, {
        availableCredit: newAvailableCredit,
        currentBalance: newCurrentBalance,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.id,
        updatedByName: currentUser.name,
      });

      // Actualizar estado local
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
      const now = new Date();
      let queryStartDate: Date;
      let queryEndDate: Date;

      // Determinar rango según filtro seleccionado
      if (timeFilter === 'custom' && customStartDate) {
        queryStartDate = customStartDate;
        queryEndDate = customEndDate || new Date(now.getFullYear(), now.getMonth() + 2, 0);
      } else if (timeFilter === 'all') {
        // 1 año atrás para "all"
        queryStartDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        queryEndDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      } else {
        // Para otros filtros: mes actual y siguiente
        queryStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
        queryEndDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      }

      // Normalizar fechas para incluir el día completo
      // Crear copias para no mutar customStartDate/customEndDate
      queryStartDate = new Date(queryStartDate);
      queryStartDate.setHours(0, 0, 0, 0);
      queryEndDate = new Date(queryEndDate);
      queryEndDate.setHours(23, 59, 59, 999);

      const instancesQuery = query(
        collection(db, 'payment_instances'),
        where('householdId', '==', currentUser.householdId),
        where('dueDate', '>=', Timestamp.fromDate(queryStartDate))
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
        (instance) => instance.dueDate <= queryEndDate
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
        // Semana de martes a lunes
        // Calcular el martes de esta semana
        const currentDay = today.getDay(); // 0=domingo, 1=lunes, 2=martes...
        // Días desde el martes: si hoy >= martes, restar (day-2); si hoy < martes, restar (day+5)
        const daysFromTuesday = currentDay >= 2 ? currentDay - 2 : currentDay + 5;
        const tuesday = new Date(today);
        tuesday.setDate(tuesday.getDate() - daysFromTuesday);
        tuesday.setHours(0, 0, 0, 0);

        // El lunes es 6 días después del martes
        const monday = new Date(tuesday);
        monday.setDate(monday.getDate() + 6);
        monday.setHours(23, 59, 59, 999);

        return { start: tuesday, end: monday };
      }

      case 'next_week': {
        // Próxima semana: martes siguiente al lunes actual hasta el lunes siguiente
        const currentDay = today.getDay();
        const daysFromTuesday = currentDay >= 2 ? currentDay - 2 : currentDay + 5;
        const thisTuesday = new Date(today);
        thisTuesday.setDate(thisTuesday.getDate() - daysFromTuesday);

        // El martes de la próxima semana es 7 días después del martes actual
        const nextTuesday = new Date(thisTuesday);
        nextTuesday.setDate(nextTuesday.getDate() + 7);
        nextTuesday.setHours(0, 0, 0, 0);

        // El lunes de la próxima semana es 6 días después del martes
        const nextMonday = new Date(nextTuesday);
        nextMonday.setDate(nextMonday.getDate() + 6);
        nextMonday.setHours(23, 59, 59, 999);

        return { start: nextTuesday, end: nextMonday };
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
    setPaymentTypeFilter('all');
    setCustomStartDate(null);
    setCustomEndDate(null);
  };

  /**
   * Verifica si hay filtros no-default activos
   */
  const hasNonDefaultFilters = (): boolean => {
    return timeFilter !== 'this_week' || !showPendingOnly || paymentTypeFilter !== 'all';
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

    // Filtro de estado - incluir 'partial' y 'overdue' en pendientes
    if (showPendingOnly) {
      filtered = filtered.filter((instance) =>
        instance.status === 'pending' || instance.status === 'partial' || instance.status === 'overdue'
      );
    }

    // Filtro de tipo de pago
    if (paymentTypeFilter === 'card') {
      filtered = filtered.filter((instance) => instance.paymentType === 'card_payment');
    } else if (paymentTypeFilter === 'service') {
      filtered = filtered.filter((instance) => instance.paymentType === 'service_payment');
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

  // Toggle selección de pago
  const togglePaymentSelection = (paymentId: string) => {
    setSelectedPayments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paymentId)) {
        newSet.delete(paymentId);
      } else {
        newSet.add(paymentId);
      }
      return newSet;
    });
  };

  // Calcular sumatoria de pagos seleccionados
  const selectedTotal = useMemo(() => {
    return instances
      .filter(i => selectedPayments.has(i.id))
      .reduce((sum, i) => {
        // Para pagos parciales, usar remainingAmount; para otros, usar amount
        const amountToPay = i.status === 'partial' && i.remainingAmount !== undefined
          ? i.remainingAmount
          : i.amount;
        return sum + amountToPay;
      }, 0);
  }, [instances, selectedPayments]);

  const getServicePaymentMethod = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    return service?.paymentMethod || 'transfer';
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

            {/* Filtro de tipo de pago */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Tipo:</span>
              <Select value={paymentTypeFilter} onValueChange={(value) => setPaymentTypeFilter(value as PaymentTypeFilter)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="card">Tarjetas</SelectItem>
                  <SelectItem value="service">Servicios</SelectItem>
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
                  value={customStartDate ? formatDateForInput(customStartDate) : ''}
                  onChange={(e) => setCustomStartDate(e.target.value ? parseLocalDate(e.target.value) : null)}
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="end-date" className="text-xs">Hasta</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={customEndDate ? formatDateForInput(customEndDate) : ''}
                  onChange={(e) => setCustomEndDate(e.target.value ? parseLocalDate(e.target.value) : null)}
                  min={customStartDate ? formatDateForInput(customStartDate) : ''}
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
      <AlertDialog open={showAdjustModal} onOpenChange={setShowAdjustModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ajustar Monto</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">{editingInstance?.description}</p>

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
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAdjustment}>
              Guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Partial Payment Modal */}
      <AlertDialog open={showPartialPaymentModal} onOpenChange={(open) => {
        if (!open) {
          setShowPartialPaymentModal(false);
          setEditingInstance(null);
          setPartialAmount('');
          setPartialNotes('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Registrar Pago Parcial
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">{editingInstance?.description}</p>

                {/* Información del pago */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Monto total:</span>
                    <span className="font-semibold">{formatCurrency(editingInstance?.amount || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pagado hasta ahora:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(editingInstance?.paidAmount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Restante:</span>
                    <span className="font-semibold text-blue-600">
                      {formatCurrency(editingInstance?.remainingAmount ?? (editingInstance?.amount || 0))}
                    </span>
                  </div>

                  {/* Progress bar */}
                  {(editingInstance?.paidAmount || 0) > 0 && (
                    <div className="mt-3">
                      <Progress
                        value={((editingInstance?.paidAmount || 0) / (editingInstance?.amount || 1)) * 100}
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground text-center mt-1">
                        {Math.round(((editingInstance?.paidAmount || 0) / (editingInstance?.amount || 1)) * 100)}% completado
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
                    Máximo: {formatCurrency(editingInstance?.remainingAmount ?? (editingInstance?.amount || 0))}
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
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSavePartialPayment} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-1" />
              Registrar Abono
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          <Card key={`${group.month}-${group.year}`} className="overflow-hidden">
            {/* Header simple en fila */}
            <CardHeader className="py-3 px-4 border-b bg-muted/30">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                {/* Izquierda: Mes y conteo */}
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg font-semibold capitalize">
                    {group.month} {group.year}
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {group.instances.length} pago{group.instances.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Derecha: Totales */}
                <div className="flex items-center gap-4">
                  <span className="text-lg font-bold tabular-nums">
                    {formatCurrency(group.totalAmount)}
                  </span>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Banknote className="h-4 w-4" />
                      {formatCurrency(group.totalTransfer)}
                    </span>
                    <span className="flex items-center gap-1 text-blue-600">
                      <CreditCard className="h-4 w-4" />
                      {formatCurrency(group.totalCard)}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {group.instances.map((instance) => {
                  const serviceLine = instance.serviceLineId
                    ? allServiceLines.find((l) => l.id === instance.serviceLineId)
                    : null;

                  return (
                    <PaymentRow
                      key={instance.id}
                      variant="calendar"
                      data={{
                        id: instance.id,
                        description: instance.description,
                        amount: instance.amount,
                        dueDate: instance.dueDate,
                        paymentType: instance.paymentType,
                        cardId: instance.cardId,
                        serviceId: instance.serviceId,
                        status: instance.status,
                        remainingAmount: instance.remainingAmount,
                        paidAmount: instance.paidAmount,
                        partialPayments: instance.partialPayments,
                        notes: instance.notes,
                      }}
                      actions={{
                        onMarkPaid: () => handleMarkAsPaid(instance),
                        onPartialPayment: () => handleOpenPartialPayment(instance),
                        onAdjust: () => handleOpenAdjust(instance),
                        onCancel: () => handleCancelPayment(instance),
                        onUnmark: () => handleUnmarkAsPaid(instance),
                        onDeletePartial: (_, paymentId) => handleDeletePartialPayment(instance, paymentId),
                        onViewCard: (cardId) => {
                          const card = cards.find(c => c.id === cardId);
                          if (card) setViewingCard(card);
                        },
                      }}
                      isSelected={selectedPayments.has(instance.id)}
                      onSelect={togglePaymentSelection}
                      getCardName={getCardName}
                      getServiceName={getServiceName}
                      getServicePaymentMethod={getServicePaymentMethod}
                      serviceLine={serviceLine}
                      showServiceLine={!!instance.serviceLineId && !!serviceLine}
                      lineStatus={serviceLine ? lineStatusMap[serviceLine.id] : 'not_programmed'}
                      showLineStatusBadge={false}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Sheet de detalles de tarjeta */}
      <CardDetailSheet
        card={viewingCard}
        open={!!viewingCard}
        onOpenChange={(open) => !open && setViewingCard(null)}
        banks={banks}
        allCards={cards}
      />

      {/* Barra flotante de selección refinada */}
      {selectedPayments.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm border border-border/50 rounded-2xl shadow-xl shadow-black/10 px-6 py-4 flex items-center gap-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">
                {selectedPayments.size}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              seleccionado{selectedPayments.size > 1 ? 's' : ''}
            </span>
          </div>
          <div className="h-8 w-px bg-border" />
          <span className="text-xl font-bold tracking-tight">
            {formatCurrency(selectedTotal)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedPayments(new Set())}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
