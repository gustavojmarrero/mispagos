import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
import { useServices } from '@/hooks/useServices';
import { useBanks } from '@/hooks/useBanks';
import { useServiceLines } from '@/hooks/useServiceLines';
import { generateCurrentAndNextMonthInstances, updateExistingInstances } from '@/lib/paymentInstances';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { es } from 'date-fns/locale';
import {
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyInput,
} from '@/lib/utils';
import type {
  ScheduledPayment,
  ScheduledPaymentFormData,
  PaymentType,
  PaymentFrequency,
  DayOfWeek,
  Card as CardType,
} from '@/lib/types';
import {
  Receipt,
  Edit,
  Trash2,
  Plus,
  X,
  CreditCard,
  Store,
  Calendar as CalendarIcon,
  DollarSign,
  Banknote,
  Search,
  Loader2,
  Info,
  Cable,
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];

// Funciones para formatear fecha DD/MM/YYYY
const formatDateDDMMYYYY = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Obtener ordinal en español
const getOrdinal = (num: number): string => {
  if (num === 1) return '1er';
  if (num === 2) return '2do';
  if (num === 3) return '3er';
  return `${num}to`;
};

// Calcular próxima fecha de vencimiento basada en billingDueDay
const getNextDueDate = (billingDueDay: number): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Crear fecha con el día de vencimiento del mes actual
  let dueDate = new Date(currentYear, currentMonth, billingDueDay);

  // Si ya pasó este mes, usar el siguiente
  if (dueDate < today) {
    dueDate = new Date(currentYear, currentMonth + 1, billingDueDay);
  }

  return dueDate;
};

export function Payments() {
  const { currentUser } = useAuth();
  const { services } = useServices();
  const { banks } = useBanks();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [returnToDashboard, setReturnToDashboard] = useState(false);
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<ScheduledPayment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'description' | 'amount' | 'type' | 'status'>('createdAt');
  const [formData, setFormData] = useState<ScheduledPaymentFormData>({
    paymentType: 'service_payment',
    frequency: 'monthly',
    description: '',
    amount: 0,
    dueDay: 1,
    dayOfWeek: 5,
    cardId: '',
    serviceId: '',
    serviceLineId: '',
    isActive: true,
  });

  // Hook para obtener líneas del servicio seleccionado
  const { serviceLines: selectedServiceLines } = useServiceLines({
    serviceId: formData.serviceId || undefined,
    activeOnly: true,
  });

  const [amountInput, setAmountInput] = useState('');
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [duplicatePayment, setDuplicatePayment] = useState<ScheduledPayment | null>(null);

  // Estados para filtros
  const [typeFilter, setTypeFilter] = useState<'all' | 'card_payment' | 'service_payment'>('all');
  const [bankFilter, setBankFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  useEffect(() => {
    fetchPayments();
    fetchCards();
  }, [currentUser]);

  // Preseleccionar tarjeta si viene cardId en la URL (desde Dashboard)
  useEffect(() => {
    const cardIdFromUrl = searchParams.get('cardId');
    const fromDashboard = searchParams.get('from') === 'dashboard';
    if (cardIdFromUrl && cards.length > 0 && !loading) {
      const cardExists = cards.some(c => c.id === cardIdFromUrl);
      if (cardExists) {
        // Guardar si viene del dashboard para regresar después
        if (fromDashboard) {
          setReturnToDashboard(true);
        }
        // Abrir formulario y preseleccionar tarjeta
        setShowForm(true);
        setFormData(prev => ({
          ...prev,
          paymentType: 'card_payment',
          cardId: cardIdFromUrl,
        }));
        // Limpiar param de URL para evitar re-triggers
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, cards, loading]);

  // Preseleccionar servicio/línea si viene en la URL (desde Dashboard)
  useEffect(() => {
    const serviceIdFromUrl = searchParams.get('serviceId');
    const serviceLineIdFromUrl = searchParams.get('serviceLineId');
    const fromDashboard = searchParams.get('from') === 'dashboard';

    if (serviceIdFromUrl && services.length > 0 && !loading) {
      const serviceExists = services.some(s => s.id === serviceIdFromUrl);
      if (serviceExists) {
        // Guardar si viene del dashboard para regresar después
        if (fromDashboard) {
          setReturnToDashboard(true);
        }

        // Obtener el servicio para verificar si es billing_cycle
        const selectedService = services.find(s => s.id === serviceIdFromUrl);
        const isBillingCycle = selectedService?.serviceType === 'billing_cycle';

        // Abrir formulario y preseleccionar servicio/línea
        setShowForm(true);

        // Calcular fecha de vencimiento inicial para billing_cycle
        const dueDay = selectedService?.billingDueDay || 15;

        setFormData(prev => ({
          ...prev,
          paymentType: 'service_payment',
          serviceId: serviceIdFromUrl,
          serviceLineId: serviceLineIdFromUrl || '',
          frequency: isBillingCycle ? 'billing_cycle' : 'monthly',
          amount: isBillingCycle ? 0 : prev.amount,
          // Pre-cargar fecha de vencimiento para billing_cycle
          paymentDate: isBillingCycle ? getNextDueDate(dueDay) : prev.paymentDate,
        }));

        // Limpiar monto si es billing_cycle
        if (isBillingCycle) {
          setAmountInput('');
        }

        // Limpiar params de URL para evitar re-triggers
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, services, loading]);

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

      setCards(cardsData.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error fetching cards:', error);
    }
  };

  const fetchPayments = async () => {
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

      setPayments(paymentsData);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || saving) return;

    // Validaciones
    if (formData.paymentType === 'card_payment' && !formData.cardId) {
      toast.error('Selecciona una tarjeta');
      return;
    }
    if (formData.paymentType === 'service_payment' && !formData.serviceId) {
      toast.error('Selecciona un servicio');
      return;
    }
    if (formData.paymentType === 'service_payment' && !formData.description) {
      toast.error('Ingresa una descripción');
      return;
    }

    // Validar fecha para pagos a tarjetas
    if (formData.paymentType === 'card_payment' && !formData.paymentDate) {
      toast.error('Ingresa la fecha de pago en formato DD/MM/YYYY');
      return;
    }

    // Validar fecha para servicios billing_cycle
    if (formData.frequency === 'billing_cycle' && !formData.paymentDate) {
      toast.error('Selecciona la fecha de vencimiento');
      return;
    }

    // Validar duplicados para pagos de tarjeta
    if (formData.paymentType === 'card_payment' && formData.cardId && formData.paymentDate) {
      const duplicate = findDuplicateCardPayment(
        formData.cardId,
        formData.paymentDate,
        editingPayment?.id
      );
      if (duplicate) {
        setDuplicatePayment(duplicate);
        return;
      }
    }

    setSaving(true);
    try {
      // Auto-generar descripción para pagos a tarjetas
      let description = formData.description;
      if (formData.paymentType === 'card_payment' && formData.cardId && formData.paymentDate) {
        description = generateCardPaymentDescription(formData.cardId, formData.paymentDate);
      }

      const dataToSave: any = {
        ...formData,
        description,
        // Limpiar campos no necesarios según el tipo
        cardId: formData.paymentType === 'card_payment' ? formData.cardId : null,
        serviceId: formData.paymentType === 'service_payment' ? formData.serviceId : null,
        // serviceLineId solo para servicios billing_cycle con líneas configuradas
        serviceLineId: formData.paymentType === 'service_payment' &&
                       formData.frequency === 'billing_cycle' &&
                       formData.serviceLineId ? formData.serviceLineId : null,
        // Para card_payment y billing_cycle: usar paymentDate
        paymentDate: (formData.paymentType === 'card_payment' || formData.frequency === 'billing_cycle')
          ? formData.paymentDate
          : null,
        // Para service_payment: usar frequency, dueDay y dayOfWeek
        frequency: formData.paymentType === 'service_payment' ? formData.frequency : null,
        dueDay: formData.paymentType === 'service_payment' && formData.frequency !== 'weekly' ? formData.dueDay : null,
        dayOfWeek: formData.paymentType === 'service_payment' && formData.frequency === 'weekly' ? formData.dayOfWeek : null,
      };

      let savedPaymentId: string;

      if (editingPayment) {
        await updateDoc(doc(db, 'scheduled_payments', editingPayment.id), {
          ...dataToSave,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.id,
          updatedByName: currentUser.name,
        });
        savedPaymentId = editingPayment.id;
        toast.success('Pago actualizado exitosamente');
      } else {
        const docRef = await addDoc(collection(db, 'scheduled_payments'), {
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
        savedPaymentId = docRef.id;
        toast.success('Pago creado exitosamente');
      }

      // Generar instancias automáticamente
      const savedPayment: ScheduledPayment = {
        ...dataToSave,
        id: savedPaymentId,
        userId: currentUser.id,
        householdId: currentUser.householdId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        updatedBy: currentUser.id,
        updatedByName: currentUser.name,
      };

      try {
        console.log('[Payments] Generando instancias para:', savedPayment);
        // Para billing_cycle, pasar el servicio completo
        const selectedService = savedPayment.frequency === 'billing_cycle' && savedPayment.serviceId
          ? services.find(s => s.id === savedPayment.serviceId)
          : undefined;

        // Si es una edición, actualizar las instancias existentes primero
        if (editingPayment) {
          console.log('[Payments] Actualizando instancias existentes...');
          await updateExistingInstances(
            savedPayment,
            currentUser.id,
            currentUser.name,
            selectedService
          );
          console.log('[Payments] Instancias existentes actualizadas');
        }

        // Luego generar nuevas instancias si faltan
        await generateCurrentAndNextMonthInstances(savedPayment, selectedService);
        console.log('[Payments] Instancias generadas exitosamente');
      } catch (instanceError) {
        console.error('[Payments] Error generando instancias:', instanceError);
        toast.warning('El pago se guardó pero hubo un problema al generar las instancias');
      }

      resetForm();

      // Si vino del dashboard, regresar
      if (returnToDashboard) {
        setReturnToDashboard(false);
        navigate('/');
        return;
      }

      await fetchPayments();
    } catch (error) {
      console.error('[Payments] Error saving payment:', error);
      toast.error('Error al guardar el pago');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (payment: ScheduledPayment) => {
    setEditingPayment(payment);
    setFormData({
      paymentType: payment.paymentType,
      frequency: payment.frequency,
      description: payment.description,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      dueDay: payment.dueDay,
      dayOfWeek: payment.dayOfWeek,
      cardId: payment.cardId || '',
      serviceId: payment.serviceId || '',
      serviceLineId: payment.serviceLineId || '',
      isActive: payment.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = async (paymentId: string) => {
    if (!confirm('¿Estás seguro de eliminar este pago programado?')) return;

    try {
      await deleteDoc(doc(db, 'scheduled_payments', paymentId));
      toast.success('Pago eliminado exitosamente');
      await fetchPayments();
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error('Error al eliminar el pago');
    }
  };

  const toggleActive = async (payment: ScheduledPayment) => {
    try {
      await updateDoc(doc(db, 'scheduled_payments', payment.id), {
        isActive: !payment.isActive,
        updatedAt: serverTimestamp(),
      });
      toast.success(payment.isActive ? 'Pago desactivado' : 'Pago activado');
      await fetchPayments();
    } catch (error) {
      console.error('Error toggling payment:', error);
      toast.error('Error al cambiar el estado del pago');
    }
  };

  const resetForm = () => {
    setFormData({
      paymentType: 'service_payment',
      frequency: 'monthly',
      description: '',
      amount: 0,
      dueDay: 1,
      dayOfWeek: 5,
      cardId: '',
      serviceId: '',
      serviceLineId: '',
      isActive: true,
    });
    setAmountInput('');
    setIsEditingAmount(false);
    setEditingPayment(null);
    setShowForm(false);
  };

  const getCardName = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    return card?.name || 'Tarjeta no encontrada';
  };

  const getCardLastDigits = (card: CardType): string => {
    // Priorizar tarjeta física, luego digital
    if (card.physicalCardNumber && card.physicalCardNumber.length >= 4) {
      return card.physicalCardNumber.slice(-4);
    }
    if (card.digitalCardNumber && card.digitalCardNumber.length >= 4) {
      return card.digitalCardNumber.slice(-4);
    }
    return card.lastDigits || '****';
  };

  const getBankName = (bankId: string): string => {
    const bank = banks.find((b) => b.id === bankId);
    return bank?.name || '';
  };

  const getServiceName = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    return service?.name || 'Servicio no encontrado';
  };

  const getServicePaymentMethod = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    return service?.paymentMethod || 'transfer';
  };

  const getFrequencyLabel = (payment: ScheduledPayment) => {
    // Para pagos a tarjetas, mostrar la fecha
    if (payment.paymentType === 'card_payment' && payment.paymentDate) {
      return formatDateDDMMYYYY(payment.paymentDate);
    }

    // Para servicios, mostrar la frecuencia
    if (!payment.frequency) return 'N/A';

    if (payment.frequency === 'billing_cycle') {
      // Obtener info del servicio para mostrar días de corte/vencimiento
      const service = services.find(s => s.id === payment.serviceId);
      if (service?.billingCycleDay && service?.billingDueDay) {
        return `Ciclo facturación (corte día ${service.billingCycleDay})`;
      }
      return 'Ciclo facturación';
    }
    if (payment.frequency === 'weekly') {
      const day = DAYS_OF_WEEK.find((d) => d.value === payment.dayOfWeek);
      return `Semanal (${day?.label || 'N/A'})`;
    }
    if (payment.frequency === 'monthly') {
      return `Mensual (día ${payment.dueDay})`;
    }
    return `Único (día ${payment.dueDay})`;
  };

  // Función para encontrar pago duplicado en el mismo período de corte
  const findDuplicateCardPayment = (cardId: string, paymentDate: Date, excludePaymentId?: string): ScheduledPayment | null => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return null;

    const { closingDay, dueDay } = card;

    // Calcular el período de corte al que pertenece paymentDate
    // El período va desde closingDay del mes hasta dueDay (que puede ser del mes siguiente)
    const paymentDay = paymentDate.getDate();
    const paymentMonth = paymentDate.getMonth();
    const paymentYear = paymentDate.getFullYear();

    let periodClosingDate: Date;
    let periodDueDate: Date;

    if (dueDay <= closingDay) {
      // El período cruza meses (ej: corte 10, pago 2)
      // Si paymentDay está entre 1 y dueDay, el período empezó el mes anterior
      // Si paymentDay está entre closingDay+1 y fin de mes, el período termina el mes siguiente
      if (paymentDay <= dueDay) {
        // Estamos en la parte final del período (mes siguiente al corte)
        periodClosingDate = new Date(paymentYear, paymentMonth - 1, closingDay);
        periodDueDate = new Date(paymentYear, paymentMonth, dueDay);
      } else if (paymentDay > closingDay) {
        // Estamos en la parte inicial del período (después del corte)
        periodClosingDate = new Date(paymentYear, paymentMonth, closingDay);
        periodDueDate = new Date(paymentYear, paymentMonth + 1, dueDay);
      } else {
        // Entre dueDay+1 y closingDay - no es un período válido para pago
        return null;
      }
    } else {
      // El período está en el mismo mes (ej: corte 5, pago 20)
      if (paymentDay > closingDay && paymentDay <= dueDay) {
        periodClosingDate = new Date(paymentYear, paymentMonth, closingDay);
        periodDueDate = new Date(paymentYear, paymentMonth, dueDay);
      } else if (paymentDay <= closingDay) {
        // Período del mes anterior
        periodClosingDate = new Date(paymentYear, paymentMonth - 1, closingDay);
        periodDueDate = new Date(paymentYear, paymentMonth - 1, dueDay);
      } else {
        // Período del mes siguiente
        periodClosingDate = new Date(paymentYear, paymentMonth, closingDay);
        periodDueDate = new Date(paymentYear, paymentMonth, dueDay);
      }
    }

    // Buscar pagos existentes para esta tarjeta en el mismo período
    const duplicate = payments.find(p => {
      if (p.id === excludePaymentId) return false;
      if (p.paymentType !== 'card_payment') return false;
      if (p.cardId !== cardId) return false;
      if (!p.paymentDate || !p.isActive) return false;

      const existingPaymentDate = p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate);

      // Verificar si el pago existente cae en el mismo período
      return existingPaymentDate > periodClosingDate && existingPaymentDate <= periodDueDate;
    });

    return duplicate || null;
  };

  const generateCardPaymentDescription = (cardId: string, paymentDate: Date): string => {
    // Obtener el mes y año de la fecha de pago
    const month = paymentDate.toLocaleString('es-ES', { month: 'long' });
    const year = paymentDate.getFullYear();

    // Contar pagos existentes para esta tarjeta en este mes/año
    const existingPayments = payments.filter(p =>
      p.paymentType === 'card_payment' &&
      p.cardId === cardId &&
      p.paymentDate &&
      p.paymentDate.getMonth() === paymentDate.getMonth() &&
      p.paymentDate.getFullYear() === paymentDate.getFullYear()
    );

    const paymentNumber = existingPayments.length + 1;

    if (paymentNumber === 1) {
      return `Pago para no generar intereses ${month}/${year}`;
    }

    const ordinal = getOrdinal(paymentNumber);
    return `Pago para no generar intereses ${month}/${year} - ${ordinal} pago`;
  };

  // Filter and sort payments
  const filteredAndSortedPayments = useMemo(() => {
    let filtered = payments;

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((payment) => payment.paymentType === typeFilter);
    }

    // Apply sub-filters for cards
    if (typeFilter === 'card_payment') {
      if (bankFilter !== 'all') {
        filtered = filtered.filter((payment) => {
          const card = cards.find((c) => c.id === payment.cardId);
          return card?.bankId === bankFilter;
        });
      }
      if (ownerFilter !== 'all') {
        filtered = filtered.filter((payment) => {
          const card = cards.find((c) => c.id === payment.cardId);
          return card?.owner === ownerFilter;
        });
      }
    }

    // Apply sub-filter for services (filter by service)
    if (typeFilter === 'service_payment' && methodFilter !== 'all') {
      filtered = filtered.filter((payment) => payment.serviceId === methodFilter);
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((payment) => {
        const searchLower = searchTerm.toLowerCase();
        const descriptionMatch = payment.description.toLowerCase().includes(searchLower);
        const cardMatch = payment.cardId && getCardName(payment.cardId).toLowerCase().includes(searchLower);
        const serviceMatch = payment.serviceId && getServiceName(payment.serviceId).toLowerCase().includes(searchLower);
        return descriptionMatch || cardMatch || serviceMatch;
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'createdAt':
          return b.createdAt.getTime() - a.createdAt.getTime(); // Más reciente primero
        case 'description':
          return a.description.localeCompare(b.description);
        case 'amount':
          return b.amount - a.amount; // Mayor a menor
        case 'type':
          return a.paymentType.localeCompare(b.paymentType);
        case 'status':
          return (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0); // Activos primero
        default:
          return 0;
      }
    });

    return sorted;
  }, [payments, searchTerm, sortBy, cards, services, typeFilter, bankFilter, ownerFilter, methodFilter]);

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
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Pagos Programados</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Gestiona los pagos que debes realizar</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="hidden sm:flex w-full sm:w-auto">
          {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showForm ? 'Cancelar' : 'Nuevo Pago'}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="shadow-md border-border">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
            <CardTitle className="text-xl sm:text-2xl">{editingPayment ? 'Editar' : 'Nuevo'} Pago</CardTitle>
            <CardDescription className="text-sm">
              {editingPayment ? 'Actualiza el pago programado' : 'Programa un nuevo pago'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tipo de Pago */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-semibold border-b pb-2 text-primary flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Tipo de Pago
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="paymentType">Pagar a *</Label>
                    <Select
                      value={formData.paymentType}
                      onValueChange={(value) => setFormData({ ...formData, paymentType: value as PaymentType })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona tipo de pago" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="service_payment">Servicio</SelectItem>
                        <SelectItem value="card_payment">Tarjeta de Crédito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.paymentType === 'card_payment' ? (
                    <div className="space-y-2">
                      <Label htmlFor="cardId">Tarjeta *</Label>
                      <Select
                        value={formData.cardId}
                        onValueChange={(value) => setFormData({ ...formData, cardId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una tarjeta" />
                        </SelectTrigger>
                        <SelectContent>
                          {cards.map((card) => (
                            <SelectItem key={card.id} value={card.id}>
                              {getBankName(card.bankId)} - {card.name} - *{getCardLastDigits(card)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {cards.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Primero agrega tarjetas en la sección "Tarjetas"
                        </p>
                      )}
                      {/* Mostrar comentarios de la tarjeta seleccionada como referencia */}
                      {formData.cardId && cards.find(c => c.id === formData.cardId)?.comments && (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <div className="flex items-start gap-2">
                            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-blue-700 mb-1">Referencia de la tarjeta:</p>
                              <p className="text-sm text-blue-800 whitespace-pre-wrap">
                                {cards.find(c => c.id === formData.cardId)?.comments}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="serviceId">Servicio *</Label>
                      <Select
                        value={formData.serviceId}
                        onValueChange={(value) => {
                          const selectedService = services.find(s => s.id === value);
                          const isBillingCycle = selectedService?.serviceType === 'billing_cycle';

                          // Calcular fecha de vencimiento inicial para billing_cycle
                          const dueDay = selectedService?.billingDueDay || 15;

                          setFormData({
                            ...formData,
                            serviceId: value,
                            serviceLineId: '', // Limpiar línea al cambiar servicio
                            // Auto-seleccionar billing_cycle si el servicio lo requiere
                            frequency: isBillingCycle ? 'billing_cycle' : formData.frequency,
                            // Monto $0 para billing_cycle (se ingresa después del corte)
                            amount: isBillingCycle ? 0 : formData.amount,
                            // Pre-cargar fecha de vencimiento para billing_cycle
                            paymentDate: isBillingCycle ? getNextDueDate(dueDay) : formData.paymentDate,
                          });

                          // Limpiar monto si es billing_cycle
                          if (isBillingCycle) {
                            setAmountInput('');
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un servicio" />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name} ({service.paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia'})
                              {service.serviceType === 'billing_cycle' && ' - Ciclo facturación'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {services.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Primero agrega servicios en la sección "Servicios"
                        </p>
                      )}
                      {/* Mensaje informativo para servicios con billing_cycle */}
                      {formData.serviceId && services.find(s => s.id === formData.serviceId)?.serviceType === 'billing_cycle' && (
                        <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                          <Info className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                          <div className="text-xs text-orange-800 dark:text-orange-200">
                            <p className="font-medium">Servicio con ciclo de facturación</p>
                            <p className="mt-1">El monto se ingresará cuando llegue el recibo. Se generarán pagos automáticos cada mes.</p>
                          </div>
                        </div>
                      )}

                      {/* Selector de línea para servicios billing_cycle con múltiples líneas */}
                      {formData.serviceId &&
                       services.find(s => s.id === formData.serviceId)?.serviceType === 'billing_cycle' &&
                       selectedServiceLines.length > 0 && (
                        <div className="space-y-2 mt-3">
                          <Label htmlFor="serviceLineId" className="flex items-center gap-2">
                            <Cable className="h-4 w-4" />
                            Línea de servicio *
                          </Label>
                          <Select
                            value={formData.serviceLineId}
                            onValueChange={(value) => {
                              const selectedLine = selectedServiceLines.find(l => l.id === value);
                              // Actualizar paymentDate con el billingDueDay de la línea seleccionada
                              const dueDay = selectedLine?.billingDueDay || 15;
                              setFormData({
                                ...formData,
                                serviceLineId: value,
                                paymentDate: getNextDueDate(dueDay),
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona una línea" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedServiceLines.map((line) => (
                                <SelectItem key={line.id} value={line.id}>
                                  {line.name}
                                  {line.lineNumber && ` (${line.lineNumber})`}
                                  {' - Corte día '}{line.billingCycleDay}{', vence día '}{line.billingDueDay}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Mostrar info del ciclo de la línea seleccionada */}
                          {formData.serviceLineId && (() => {
                            const selectedLine = selectedServiceLines.find(l => l.id === formData.serviceLineId);
                            if (!selectedLine) return null;
                            return (
                              <div className="grid grid-cols-2 gap-3 mt-2">
                                <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg text-center">
                                  <p className="text-xs text-muted-foreground mb-1">Día de corte</p>
                                  <p className="text-xl font-bold text-orange-600">{selectedLine.billingCycleDay}</p>
                                </div>
                                <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-center">
                                  <p className="text-xs text-muted-foreground mb-1">Día de vencimiento</p>
                                  <p className="text-xl font-bold text-red-600">{selectedLine.billingDueDay}</p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Mensaje si el servicio billing_cycle no tiene líneas configuradas */}
                      {formData.serviceId &&
                       services.find(s => s.id === formData.serviceId)?.serviceType === 'billing_cycle' &&
                       selectedServiceLines.length === 0 && (
                        <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800 mt-3">
                          <Info className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                          <div className="text-xs text-yellow-800 dark:text-yellow-200">
                            <p className="font-medium">Sin líneas configuradas</p>
                            <p className="mt-1">Este servicio no tiene líneas configuradas. Puedes configurarlas en la sección de Servicios para tener diferentes ciclos de facturación.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Detalles */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-semibold border-b pb-2 text-primary flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Detalles del Pago
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {formData.paymentType === 'service_payment' && (
                    <div className="space-y-2">
                      <Label htmlFor="description">Descripción *</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Ej: Pago mensual de Netflix"
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="amount">Monto *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                        $
                      </span>
                      <Input
                        id="amount"
                        type="text"
                        value={isEditingAmount ? amountInput : formatCurrencyInput(formData.amount.toString())}
                        onChange={(e) => setAmountInput(e.target.value)}
                        onFocus={(e) => {
                          setIsEditingAmount(true);
                          setAmountInput(formData.amount > 0 ? formData.amount.toString() : '');
                          setTimeout(() => e.target.select(), 0);
                        }}
                        onBlur={() => {
                          const value = parseCurrencyInput(amountInput);
                          setFormData({ ...formData, amount: value });
                          setIsEditingAmount(false);
                        }}
                        placeholder="0.00"
                        className="pl-7 h-12 text-lg font-semibold bg-muted/60"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Frecuencia / Fecha */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-semibold border-b pb-2 text-primary flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  {formData.paymentType === 'card_payment' ? 'Fecha de Pago' : 'Frecuencia'}
                </h3>

                {formData.paymentType === 'card_payment' ? (
                  // DatePicker para pagos a tarjetas
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Fecha de pago *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${
                              !formData.paymentDate && 'text-muted-foreground'
                            }`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.paymentDate
                              ? formatDateDDMMYYYY(formData.paymentDate)
                              : 'Selecciona una fecha'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.paymentDate}
                            onSelect={(date) => {
                              if (date) {
                                setFormData({ ...formData, paymentDate: date });
                              }
                            }}
                            locale={es}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                ) : formData.frequency === 'billing_cycle' ? (
                  // Información y DatePicker para servicios con ciclo de facturación
                  <div className="space-y-4">
                    {/* Información del ciclo de corte */}
                    <div className="p-4 bg-muted/50 rounded-lg border">
                      <p className="text-sm font-medium mb-2">Ciclo de facturación</p>
                      {(() => {
                        const selectedService = services.find(s => s.id === formData.serviceId);
                        const selectedLine = selectedServiceLines.find(l => l.id === formData.serviceLineId);
                        const billingCycleDay = selectedLine?.billingCycleDay || selectedService?.billingCycleDay;

                        if (billingCycleDay) {
                          return (
                            <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/30 rounded">
                              <p className="text-xs text-muted-foreground">Día de corte</p>
                              <p className="text-xl font-bold text-orange-600">{billingCycleDay}</p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {/* DatePicker para fecha de vencimiento */}
                    <div className="space-y-2">
                      <Label>Fecha de vencimiento *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${
                              !formData.paymentDate && 'text-muted-foreground'
                            }`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.paymentDate
                              ? formatDateDDMMYYYY(formData.paymentDate)
                              : 'Selecciona fecha de vencimiento'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.paymentDate}
                            onSelect={(date) => {
                              if (date) {
                                setFormData({ ...formData, paymentDate: date });
                              }
                            }}
                            locale={es}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground">
                        Puedes ajustar si el día cae en festivo o fin de semana
                      </p>
                    </div>
                  </div>
                ) : (
                  // Selector de frecuencia para servicios normales
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="frequency">Frecuencia *</Label>
                      <Select
                        value={formData.frequency}
                        onValueChange={(value) => setFormData({ ...formData, frequency: value as PaymentFrequency })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona frecuencia" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Mensual</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="once">Único (una vez)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.frequency === 'weekly' ? (
                      <div className="space-y-2">
                        <Label htmlFor="dayOfWeek">Día de la semana *</Label>
                        <Select
                          value={formData.dayOfWeek?.toString()}
                          onValueChange={(value) => setFormData({ ...formData, dayOfWeek: parseInt(value) as DayOfWeek })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona día" />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS_OF_WEEK.map((day) => (
                              <SelectItem key={day.value} value={day.value.toString()}>
                                {day.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="dueDay">Día del mes *</Label>
                        <Input
                          id="dueDay"
                          type="number"
                          min="1"
                          max="31"
                          value={formData.dueDay}
                          onChange={(e) => setFormData({ ...formData, dueDay: parseInt(e.target.value) || 1 })}
                          onFocus={(e) => e.target.select()}
                          placeholder="1-31"
                          required
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

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
                    editingPayment ? 'Actualizar' : 'Guardar'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search and Filter */}
      <Card className="shadow-sm">
        <CardContent className="pt-6 space-y-4">
          {/* Filtro principal: Tipo de pago */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={typeFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setTypeFilter('all');
                setBankFilter('all');
                setOwnerFilter('all');
                setMethodFilter('all');
              }}
            >
              Todos
            </Button>
            <Button
              variant={typeFilter === 'card_payment' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setTypeFilter('card_payment');
                setMethodFilter('all');
              }}
            >
              <CreditCard className="h-4 w-4 mr-1" />
              Tarjetas
            </Button>
            <Button
              variant={typeFilter === 'service_payment' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setTypeFilter('service_payment');
                setBankFilter('all');
                setOwnerFilter('all');
              }}
            >
              <Store className="h-4 w-4 mr-1" />
              Servicios
            </Button>
          </div>

          {/* Sub-filtros condicionales */}
          {typeFilter === 'card_payment' && (
            <div className="flex flex-wrap gap-3">
              <Select value={bankFilter} onValueChange={setBankFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Banco" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los bancos</SelectItem>
                  {banks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Propietario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Gustavo">Gustavo</SelectItem>
                  <SelectItem value="Sandra">Sandra</SelectItem>
                  <SelectItem value="Guatever">Guatever</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {typeFilter === 'service_payment' && (
            <div className="flex flex-wrap gap-3">
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="Servicio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los servicios</SelectItem>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Búsqueda y ordenamiento */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar pagos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sortBy} onValueChange={(value: 'createdAt' | 'description' | 'amount' | 'type' | 'status') => setSortBy(value)}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Más recientes primero</SelectItem>
                <SelectItem value="description">Ordenar por nombre</SelectItem>
                <SelectItem value="amount">Ordenar por monto</SelectItem>
                <SelectItem value="type">Ordenar por tipo</SelectItem>
                <SelectItem value="status">Ordenar por estado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Contador de resultados */}
          {(searchTerm || typeFilter !== 'all' || bankFilter !== 'all' || ownerFilter !== 'all' || methodFilter !== 'all') && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {filteredAndSortedPayments.length} de {payments.length} pagos
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setTypeFilter('all');
                  setBankFilter('all');
                  setOwnerFilter('all');
                  setMethodFilter('all');
                }}
                className="h-auto p-1"
              >
                <X className="h-3 w-3 mr-1" />
                Limpiar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments List */}
      <div className="space-y-4">
        {filteredAndSortedPayments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
              {payments.length === 0 ? (
                <>
                  <p className="text-muted-foreground">No hay pagos programados</p>
                  <p className="text-sm text-muted-foreground">Haz clic en "Nuevo Pago" para agregar uno</p>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">No se encontraron pagos</p>
                  <p className="text-sm text-muted-foreground">Intenta con otros términos de búsqueda</p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredAndSortedPayments.map((payment) => {
            const Icon = payment.paymentType === 'card_payment' ? CreditCard : Store;
            // Los pagos a tarjetas de crédito se realizan con transferencia
            // Solo los servicios pueden pagarse con tarjeta
            const isPaidByCard =
              payment.paymentType === 'service_payment' &&
              payment.serviceId &&
              getServicePaymentMethod(payment.serviceId) === 'card';

            return (
              <Card
                key={payment.id}
                className={`relative transition-all duration-300 ${
                  payment.isActive ? 'border-border' : 'opacity-60 bg-muted/50'
                }`}
              >
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1 w-full sm:w-auto">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <h3 className="font-semibold text-base sm:text-lg break-words">{payment.description}</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground break-words">
                            {payment.paymentType === 'card_payment'
                              ? `Tarjeta: ${getCardName(payment.cardId || '')}`
                              : `Servicio: ${getServiceName(payment.serviceId || '')}`}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs sm:text-sm text-muted-foreground">Monto</p>
                          <p className="font-semibold text-base sm:text-lg">{formatCurrency(payment.amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {payment.paymentType === 'card_payment' ? 'Fecha de pago' : 'Frecuencia'}
                          </p>
                          <p className="font-semibold text-sm sm:text-base">
                            {getFrequencyLabel(payment)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm text-muted-foreground">Método de pago</p>
                          <div className="flex items-center gap-1">
                            {isPaidByCard ? (
                              <>
                                <CreditCard className="h-4 w-4 text-blue-600" />
                                <span className="text-sm sm:text-base font-semibold text-blue-600">Tarjeta</span>
                              </>
                            ) : (
                              <>
                                <Banknote className="h-4 w-4 text-green-600" />
                                <span className="text-sm sm:text-base font-semibold text-green-600">Transferencia</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm text-muted-foreground">Estado</p>
                          <Badge variant={payment.isActive ? 'default' : 'secondary'}>
                            {payment.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col gap-2 w-full sm:w-auto sm:ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(payment)}
                        className="flex-1 sm:flex-none min-h-[44px]"
                      >
                        {payment.isActive ? 'Desactivar' : 'Activar'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(payment)}
                        className="flex-1 sm:flex-none min-h-[44px]"
                      >
                        <Edit className="h-4 w-4 sm:mr-0 mr-2" />
                        <span className="sm:hidden">Editar</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(payment.id)}
                        className="flex-1 sm:flex-none min-h-[44px]"
                      >
                        <Trash2 className="h-4 w-4 text-destructive sm:mr-0 mr-2" />
                        <span className="sm:hidden">Eliminar</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Botón flotante fijo - Solo en móvil */}
      <Button
        onClick={() => setShowForm(!showForm)}
        className="sm:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        {showForm ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </Button>

      {/* Modal de pago duplicado */}
      <AlertDialog open={!!duplicatePayment} onOpenChange={() => setDuplicatePayment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pago ya programado</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Ya existe un pago programado para esta tarjeta en el mismo período de corte:
                </p>
                {duplicatePayment && (
                  <div className="bg-muted p-3 rounded-md space-y-1">
                    <p className="font-medium">{duplicatePayment.description}</p>
                    <p className="text-sm">
                      Monto: {formatCurrency(duplicatePayment.amount)}
                    </p>
                    {duplicatePayment.paymentDate && (
                      <p className="text-sm">
                        Fecha: {(duplicatePayment.paymentDate instanceof Date
                          ? duplicatePayment.paymentDate
                          : new Date(duplicatePayment.paymentDate)
                        ).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (duplicatePayment) {
                  handleEdit(duplicatePayment);
                  setDuplicatePayment(null);
                }
              }}
            >
              Editar pago existente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
