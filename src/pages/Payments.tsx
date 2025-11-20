import { useEffect, useState } from 'react';
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
import { generateCurrentAndNextMonthInstances } from '@/lib/paymentInstances';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
  Calendar,
  DollarSign,
  Banknote,
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

const parseDateDDMMYYYY = (dateStr: string): Date | null => {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Los meses en JS van de 0-11
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (day < 1 || day > 31 || month < 0 || month > 11 || year < 1900) return null;

  return new Date(year, month, day);
};

// Obtener ordinal en español
const getOrdinal = (num: number): string => {
  if (num === 1) return '1er';
  if (num === 2) return '2do';
  if (num === 3) return '3er';
  return `${num}to`;
};

export function Payments() {
  const { currentUser } = useAuth();
  const { services } = useServices();
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<ScheduledPayment | null>(null);
  const [formData, setFormData] = useState<ScheduledPaymentFormData>({
    paymentType: 'service_payment',
    frequency: 'monthly',
    description: '',
    amount: 0,
    dueDay: 1,
    dayOfWeek: 5,
    cardId: '',
    serviceId: '',
    isActive: true,
  });

  const [amountInput, setAmountInput] = useState('');
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [dateInput, setDateInput] = useState('');

  useEffect(() => {
    fetchPayments();
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

      setPayments(paymentsData.sort((a, b) => {
        // Ordenar por paymentDate, dueDay o dayOfWeek
        if (a.paymentDate && b.paymentDate) {
          return a.paymentDate.getTime() - b.paymentDate.getTime();
        }
        if (a.frequency === 'weekly' && b.frequency === 'weekly') {
          return (a.dayOfWeek || 0) - (b.dayOfWeek || 0);
        }
        return (a.dueDay || 0) - (b.dueDay || 0);
      }));
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    // Validaciones
    if (formData.paymentType === 'card_payment' && !formData.cardId) {
      alert('Selecciona una tarjeta');
      return;
    }
    if (formData.paymentType === 'service_payment' && !formData.serviceId) {
      alert('Selecciona un servicio');
      return;
    }
    if (formData.paymentType === 'service_payment' && !formData.description) {
      alert('Ingresa una descripción');
      return;
    }

    // Validar fecha para pagos a tarjetas
    if (formData.paymentType === 'card_payment' && !formData.paymentDate) {
      alert('Ingresa la fecha de pago en formato DD/MM/YYYY');
      return;
    }

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
        // Para card_payment: usar paymentDate
        paymentDate: formData.paymentType === 'card_payment' ? formData.paymentDate : null,
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
      }

      // Generar instancias automáticamente
      const savedPayment: ScheduledPayment = {
        ...dataToSave,
        id: savedPaymentId,
        userId: currentUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        console.log('[Payments] Generando instancias para:', savedPayment);
        await generateCurrentAndNextMonthInstances(savedPayment);
        console.log('[Payments] Instancias generadas exitosamente');
      } catch (instanceError) {
        console.error('[Payments] Error generando instancias:', instanceError);
        // No fallar todo el guardado si solo falla la generación de instancias
      }

      resetForm();
      await fetchPayments();
    } catch (error) {
      console.error('[Payments] Error saving payment:', error);
      alert('Error al guardar el pago. Revisa la consola para más detalles.');
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
      isActive: payment.isActive,
    });
    // Cargar la fecha formateada en el input si existe
    if (payment.paymentDate) {
      setDateInput(formatDateDDMMYYYY(payment.paymentDate));
    }
    setShowForm(true);
  };

  const handleDelete = async (paymentId: string) => {
    if (!confirm('¿Estás seguro de eliminar este pago programado?')) return;

    try {
      await deleteDoc(doc(db, 'scheduled_payments', paymentId));
      await fetchPayments();
    } catch (error) {
      console.error('Error deleting payment:', error);
    }
  };

  const toggleActive = async (payment: ScheduledPayment) => {
    try {
      await updateDoc(doc(db, 'scheduled_payments', payment.id), {
        isActive: !payment.isActive,
        updatedAt: serverTimestamp(),
      });
      await fetchPayments();
    } catch (error) {
      console.error('Error toggling payment:', error);
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
      isActive: true,
    });
    setAmountInput('');
    setIsEditingAmount(false);
    setDateInput('');
    setEditingPayment(null);
    setShowForm(false);
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

  const getFrequencyLabel = (payment: ScheduledPayment) => {
    // Para pagos a tarjetas, mostrar la fecha
    if (payment.paymentType === 'card_payment' && payment.paymentDate) {
      return formatDateDDMMYYYY(payment.paymentDate);
    }

    // Para servicios, mostrar la frecuencia
    if (!payment.frequency) return 'N/A';

    if (payment.frequency === 'weekly') {
      const day = DAYS_OF_WEEK.find((d) => d.value === payment.dayOfWeek);
      return `Semanal (${day?.label || 'N/A'})`;
    }
    if (payment.frequency === 'monthly') {
      return `Mensual (día ${payment.dueDay})`;
    }
    return `Único (día ${payment.dueDay})`;
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
        <Button onClick={() => setShowForm(!showForm)} className="w-full sm:w-auto">
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
                              {card.name} - {formatCurrency(card.currentBalance)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {cards.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Primero agrega tarjetas en la sección "Tarjetas"
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="serviceId">Servicio *</Label>
                      <Select
                        value={formData.serviceId}
                        onValueChange={(value) => setFormData({ ...formData, serviceId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un servicio" />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name} ({service.paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {services.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Primero agrega servicios en la sección "Servicios"
                        </p>
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
                        className="pl-7"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Frecuencia / Fecha */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-semibold border-b pb-2 text-primary flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {formData.paymentType === 'card_payment' ? 'Fecha de Pago' : 'Frecuencia'}
                </h3>

                {formData.paymentType === 'card_payment' ? (
                  // Input de fecha para pagos a tarjetas
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="paymentDate">Fecha de pago (DD/MM/YYYY) *</Label>
                      <Input
                        id="paymentDate"
                        type="text"
                        value={dateInput}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDateInput(value);

                          // Intentar parsear la fecha mientras el usuario escribe
                          const parsedDate = parseDateDDMMYYYY(value);
                          if (parsedDate) {
                            setFormData({ ...formData, paymentDate: parsedDate });
                          }
                        }}
                        onFocus={(e) => setTimeout(() => e.target.select(), 0)}
                        placeholder="DD/MM/YYYY"
                        maxLength={10}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Ejemplo: 15/11/2025
                      </p>
                    </div>
                  </div>
                ) : (
                  // Selector de frecuencia para servicios
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
                <Button type="button" variant="outline" onClick={resetForm} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button type="submit" className="w-full sm:w-auto">
                  {editingPayment ? 'Actualizar' : 'Guardar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Payments List */}
      <div className="space-y-4">
        {payments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay pagos programados</p>
              <p className="text-sm text-muted-foreground">Haz clic en "Nuevo Pago" para agregar uno</p>
            </CardContent>
          </Card>
        ) : (
          payments.map((payment) => {
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
    </div>
  );
}
