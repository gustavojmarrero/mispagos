import { useEffect, useState, useMemo } from 'react';
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
  arrayUnion,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useBanks } from '@/hooks/useBanks';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { InputWithCopy } from '@/components/ui/input-with-copy';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CardSkeletonGrid } from '@/components/CardSkeleton';
import {
  formatCurrencyInput,
  parseCurrencyInput,
  detectCardType,
  isValidCLABE,
  formatCardNumber,
  unformatCardNumber,
  formatCLABE,
  unformatCLABE,
} from '@/lib/utils';
import type { Card as CardType, CardFormData, CardOwner, PaymentInstance, PaymentStatus, PhysicalCard } from '@/lib/types';
import {
  CreditCard,
  Plus,
  X,
  Smartphone,
  Building2,
  DollarSign,
  User,
  Search,
  Loader2,
  MessageSquare,
  Check,
  Trash2,
} from 'lucide-react';
import { ViewToggle, type ViewMode } from '@/components/ui/view-toggle';
import { Switch } from '@/components/ui/switch';
import { Pagination } from '@/components/ui/pagination';
import { CardGridItem } from '@/components/cards/CardGridItem';
import { CardListItem } from '@/components/cards/CardListItem';
import { CardDetailSheet } from '@/components/cards/CardDetailSheet';
import { formatCurrency } from '@/lib/utils';

export function Cards() {
  const { currentUser } = useAuth();
  const { banks } = useBanks();
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<CardType | null>(null);
  const [viewingCard, setViewingCard] = useState<CardType | null>(null);
  const [formData, setFormData] = useState<CardFormData>({
    name: '',
    lastDigits: '',
    closingDay: 0,
    dueDay: 0,
    creditLimit: 0,
    currentBalance: 0,
    physicalCardNumber: '', // Deprecated: keep for compatibility
    physicalCards: [], // New: array of physical cards
    cardType: 'Departamental',
    digitalCardNumber: '',
    clabeAccount: '',
    owner: 'Gustavo',
    bankId: '',
    availableCredit: 0,
    comments: '',
  });

  // Estados para valores de entrada sin formato (mientras el usuario escribe)
  const [creditLimitInput, setCreditLimitInput] = useState('');
  const [availableCreditInput, setAvailableCreditInput] = useState('');
  const [isEditingCreditLimit, setIsEditingCreditLimit] = useState(false);
  const [isEditingAvailableCredit, setIsEditingAvailableCredit] = useState(false);
  const [closingDayInput, setClosingDayInput] = useState('');
  const [dueDayInput, setDueDayInput] = useState('');
  const [isEditingClosingDay, setIsEditingClosingDay] = useState(false);
  const [isEditingDueDay, setIsEditingDueDay] = useState(false);

  // Estados para búsqueda y ordenamiento
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'bank' | 'credit'>('credit');
  const [hideDepartmental, setHideDepartmental] = useState(() => {
    const saved = localStorage.getItem('cards-hide-departmental');
    return saved === 'true';
  });

  // Estados para vista y paginación
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('cards-view-mode');
    return (saved as ViewMode) || 'list';
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('cards-items-per-page');
    return saved ? parseInt(saved) : 12;
  });

  // Estados para payment instances
  const [cardPayments, setCardPayments] = useState<PaymentInstance[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Estados para modales de pago
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentInstance | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [partialNotes, setPartialNotes] = useState('');

  useEffect(() => {
    fetchCards();
  }, [currentUser]);

  // Calcular automáticamente el saldo actual
  useEffect(() => {
    const calculatedBalance = formData.creditLimit - formData.availableCredit;
    if (calculatedBalance !== formData.currentBalance) {
      setFormData(prev => ({
        ...prev,
        currentBalance: calculatedBalance,
      }));
    }
  }, [formData.creditLimit, formData.availableCredit]);

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
        // Valores por defecto para campos nuevos
        cardType: doc.data().cardType || 'Departamental',
        owner: doc.data().owner || 'Gustavo',
        bankId: doc.data().bankId || '',
        availableCredit: doc.data().availableCredit || 0,
      })) as CardType[];

      setCards(cardsData.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error fetching cards:', error);
    } finally {
      setLoading(false);
    }
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
    return (
      <Badge
        variant={config.variant}
        className={status === 'partial' ? 'bg-blue-600 hover:bg-blue-700' : ''}
      >
        {config.label}
      </Badge>
    );
  };

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

      // Actualizar viewingCard si es la misma tarjeta
      if (viewingCard?.id === cardId) {
        setViewingCard(prev => prev ? {
          ...prev,
          availableCredit: newAvailableCredit,
          currentBalance: newCurrentBalance
        } : null);
      }
    } catch (error) {
      console.error('Error updating card available credit:', error);
    }
  };

  const fetchCardPayments = async (cardId: string) => {
    if (!currentUser) return;

    setLoadingPayments(true);
    try {
      // Obtener solo pagos vinculados a la tarjeta específica
      const paymentsQuery = query(
        collection(db, 'payment_instances'),
        where('householdId', '==', currentUser.householdId),
        where('cardId', '==', cardId),
        where('paymentType', '==', 'card_payment')
      );

      const snapshot = await getDocs(paymentsQuery);
      const paymentsData = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        dueDate: doc.data().dueDate?.toDate() || new Date(),
        paidDate: doc.data().paidDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as PaymentInstance[];

      // Ordenar por fecha (próximos primero)
      paymentsData.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

      setCardPayments(paymentsData);
    } catch (error) {
      console.error('Error fetching card payments:', error);
      toast.error('Error al cargar pagos de la tarjeta');
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleMarkAsPaid = async (instance: PaymentInstance) => {
    if (!currentUser) return;

    try {
      // Calcular el monto que se está pagando ahora
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

      // Actualizar el disponible de la tarjeta
      if (instance.cardId) {
        await updateCardAvailableCredit(instance.cardId, amountBeingPaid, 'add');
      }

      toast.success('Pago marcado como realizado');

      // Recargar pagos de la tarjeta
      if (viewingCard) {
        await fetchCardPayments(viewingCard.id);
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('Error al marcar como pagado');
    }
  };

  const handleOpenPartialPayment = (instance: PaymentInstance) => {
    setEditingPayment(instance);
    setPartialAmount('');
    setPartialNotes('');
    setShowPartialPaymentModal(true);
  };

  const handleSavePartialPayment = async () => {
    if (!currentUser) return;
    if (!editingPayment) return;

    const amountToPay = parseCurrencyInput(partialAmount);
    if (amountToPay <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    const currentRemaining = editingPayment.remainingAmount ?? editingPayment.amount;
    const currentPaid = editingPayment.paidAmount ?? 0;

    if (amountToPay > currentRemaining) {
      toast.error(`El monto excede lo pendiente (${formatCurrency(currentRemaining)})`);
      return;
    }

    try {
      // Crear registro de pago parcial
      const newPartialPayment: any = {
        id: crypto.randomUUID(),
        amount: amountToPay,
        paidDate: Date.now(),
        paidBy: currentUser.id,
        paidByName: currentUser.name,
      };

      // Solo agregar notes si tiene valor
      if (partialNotes && partialNotes.trim()) {
        newPartialPayment.notes = partialNotes;
      }

      // Calcular nuevos valores
      const newPaidAmount = currentPaid + amountToPay;
      const newRemainingAmount = editingPayment.amount - newPaidAmount;
      const isFullyPaid = newRemainingAmount === 0;

      // Actualizar en Firestore
      await updateDoc(doc(db, 'payment_instances', editingPayment.id), {
        status: isFullyPaid ? 'paid' : 'partial',
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        partialPayments: arrayUnion(newPartialPayment),
        paidDate: isFullyPaid ? serverTimestamp() : editingPayment.paidDate || null,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.id,
        updatedByName: currentUser.name,
      });

      // Actualizar el disponible de la tarjeta
      if (editingPayment.cardId) {
        await updateCardAvailableCredit(editingPayment.cardId, amountToPay, 'add');
      }

      toast.success(
        isFullyPaid
          ? 'Pago completado'
          : `Pago parcial registrado: ${formatCurrency(amountToPay)}`
      );

      setShowPartialPaymentModal(false);
      setEditingPayment(null);
      setPartialAmount('');
      setPartialNotes('');

      // Recargar pagos de la tarjeta
      if (viewingCard) {
        await fetchCardPayments(viewingCard.id);
      }
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
      // Filtrar el array de pagos parciales
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
          if (p.notes !== undefined) {
            cleanPayment.notes = p.notes;
          }
          return cleanPayment;
        });

      const newPaidAmount = (instance.paidAmount || 0) - payment.amount;
      const newRemainingAmount = instance.amount - newPaidAmount;

      // Actualizar el documento
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

      // Revertir el disponible de la tarjeta
      if (instance.cardId) {
        await updateCardAvailableCredit(instance.cardId, payment.amount, 'subtract');
      }

      toast.success('Pago parcial eliminado');

      // Recargar pagos de la tarjeta
      if (viewingCard) {
        await fetchCardPayments(viewingCard.id);
      }
    } catch (error: any) {
      console.error('Error deleting partial payment:', error);
      toast.error('Error al eliminar el pago parcial');
    }
  };

  const handleDigitalCardNumberChange = (value: string) => {
    const cleaned = unformatCardNumber(value);

    // Solo usar digital para tipo y lastDigits si NO hay tarjetas físicas
    const hasPhysicalCards = formData.physicalCards && formData.physicalCards.length > 0 &&
      formData.physicalCards.some(pc => unformatCardNumber(pc.number).length >= 4);

    const shouldUseDigital = !hasPhysicalCards && cleaned.length >= 4;

    setFormData({
      ...formData,
      digitalCardNumber: value,
      cardType: shouldUseDigital ? detectCardType(cleaned) : formData.cardType,
      lastDigits: shouldUseDigital ? cleaned.slice(-4) : formData.lastDigits,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || saving) return;

    if (formData.clabeAccount && !isValidCLABE(formData.clabeAccount)) {
      toast.error('La cuenta CLABE debe tener exactamente 18 dígitos');
      return;
    }

    if (formData.closingDay < 1 || formData.closingDay > 31) {
      toast.error('El día de corte debe estar entre 1 y 31');
      return;
    }

    if (formData.dueDay < 1 || formData.dueDay > 31) {
      toast.error('El día de pago debe estar entre 1 y 31');
      return;
    }

    setSaving(true);
    try {
      // Preparar datos sin formato para guardar en la base de datos
      // Procesar physicalCards: limpiar números
      const cleanedPhysicalCards = (formData.physicalCards || [])
        .filter(card => card.number.trim() !== '') // Filtrar tarjetas sin número
        .map(card => ({
          id: card.id,
          number: unformatCardNumber(card.number),
          digitalNumber: card.digitalNumber ? unformatCardNumber(card.digitalNumber) : undefined,
          label: card.label.trim(),
        }))
        .map(card => {
          // Limpiar campos undefined para Firestore
          const cleanCard: any = { id: card.id, number: card.number, label: card.label };
          if (card.digitalNumber) cleanCard.digitalNumber = card.digitalNumber;
          return cleanCard;
        });

      const dataToSave = {
        ...formData,
        physicalCardNumber: unformatCardNumber(formData.physicalCardNumber || ''),
        physicalCards: cleanedPhysicalCards,
        digitalCardNumber: unformatCardNumber(formData.digitalCardNumber || ''),
        clabeAccount: unformatCLABE(formData.clabeAccount || ''),
      };

      if (editingCard) {
        await updateDoc(doc(db, 'cards', editingCard.id), {
          ...dataToSave,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.id,
          updatedByName: currentUser.name,
        });
        toast.success('Tarjeta actualizada exitosamente');
      } else {
        // Crear nueva tarjeta
        await addDoc(collection(db, 'cards'), {
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
        toast.success('Tarjeta creada exitosamente');
      }

      resetForm();
      await fetchCards();
    } catch (error) {
      console.error('Error saving card:', error);
      toast.error('Error al guardar la tarjeta');
    } finally {
      setSaving(false);
    }
  };

  const handleView = (card: CardType) => {
    setViewingCard(card);
  };

  const handleEditFromView = (card: CardType) => {
    setViewingCard(null);
    handleEdit(card);
  };

  const handleEdit = (card: CardType) => {
    setEditingCard(card);

    // Recalcular cardType si es Unknown o si hay números de tarjeta
    let cardType = card.cardType;
    let lastDigits = card.lastDigits;

    // Migrar datos: si hay physicalCardNumber pero no physicalCards, crear el primer elemento
    let physicalCards: PhysicalCard[] = card.physicalCards || [];
    if (physicalCards.length === 0 && card.physicalCardNumber) {
      physicalCards = [{
        id: crypto.randomUUID(),
        number: formatCardNumber(card.physicalCardNumber),
        digitalNumber: card.digitalCardNumber ? formatCardNumber(card.digitalCardNumber) : '',
        label: card.owner, // Usar el owner como label por defecto
      }];
    } else {
      // Formatear los números para edición
      physicalCards = physicalCards.map(pc => ({
        ...pc,
        number: formatCardNumber(pc.number),
        digitalNumber: pc.digitalNumber ? formatCardNumber(pc.digitalNumber) : '',
      }));
    }

    // Detectar tipo de la primera tarjeta física o digital
    if (physicalCards.length > 0) {
      const firstCardCleaned = unformatCardNumber(physicalCards[0].number);
      if (firstCardCleaned.length >= 4) {
        cardType = detectCardType(firstCardCleaned);
        lastDigits = firstCardCleaned.slice(-4);
      }
    } else {
      const digitalCleaned = card.digitalCardNumber || '';
      if (digitalCleaned.length >= 4) {
        cardType = detectCardType(digitalCleaned);
        lastDigits = digitalCleaned.slice(-4);
      }
    }

    setFormData({
      name: card.name,
      lastDigits,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      creditLimit: card.creditLimit,
      currentBalance: card.currentBalance,
      physicalCardNumber: card.physicalCardNumber || '',
      physicalCards,
      cardType,
      digitalCardNumber: card.digitalCardNumber || '',
      clabeAccount: card.clabeAccount || '',
      owner: card.owner,
      bankId: card.bankId,
      availableCredit: card.availableCredit,
      comments: card.comments || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (cardId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta tarjeta?')) return;

    try {
      await deleteDoc(doc(db, 'cards', cardId));
      toast.success('Tarjeta eliminada exitosamente');
      await fetchCards();
    } catch (error) {
      console.error('Error deleting card:', error);
      toast.error('Error al eliminar la tarjeta');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      lastDigits: '',
      closingDay: 0,
      dueDay: 0,
      creditLimit: 0,
      currentBalance: 0,
      physicalCardNumber: '',
      physicalCards: [],
      cardType: 'Departamental',
      digitalCardNumber: '',
      clabeAccount: '',
      owner: 'Gustavo',
      bankId: '',
      availableCredit: 0,
      comments: '',
    });
    setEditingCard(null);
    setShowForm(false);
    setClosingDayInput('');
    setDueDayInput('');
  };

  const getBankName = (bankId: string) => {
    const bank = banks.find((b) => b.id === bankId);
    return bank?.name || 'Sin banco';
  };

  // Filtrado y ordenamiento de tarjetas
  const filteredAndSortedCards = useMemo(() => {
    let result = [...cards];

    // Filtrar tarjetas departamentales si está activado el toggle
    if (hideDepartmental) {
      result = result.filter((card) => card.cardType !== 'Departamental');
    }

    // Filtrar por búsqueda
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(
        (card) =>
          card.name.toLowerCase().includes(search) ||
          card.lastDigits.includes(search) ||
          getBankName(card.bankId).toLowerCase().includes(search) ||
          card.owner.toLowerCase().includes(search) ||
          (card.digitalCardNumber && card.digitalCardNumber.includes(search)) ||
          (card.physicalCardNumber && card.physicalCardNumber.includes(search))
      );
    }

    // Ordenar
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'balance':
          return b.currentBalance - a.currentBalance;
        case 'bank':
          return getBankName(a.bankId).localeCompare(getBankName(b.bankId));
        case 'credit':
          return b.availableCredit - a.availableCredit;
        default:
          return 0;
      }
    });

    return result;
  }, [cards, searchTerm, sortBy, banks, hideDepartmental]);

  // Paginación
  const totalPages = Math.ceil(filteredAndSortedCards.length / itemsPerPage);
  const paginatedCards = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedCards.slice(start, start + itemsPerPage);
  }, [filteredAndSortedCards, currentPage, itemsPerPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  // Cargar pagos cuando se abre el Sheet de detalles de tarjeta
  useEffect(() => {
    if (viewingCard) {
      fetchCardPayments(viewingCard.id);
    } else {
      setCardPayments([]);
    }
  }, [viewingCard]);

  // Handlers con persistencia
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('cards-view-mode', mode);
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1);
    localStorage.setItem('cards-items-per-page', items.toString());
  };

  const handleHideDepartmentalChange = (checked: boolean) => {
    setHideDepartmental(checked);
    setCurrentPage(1);
    localStorage.setItem('cards-hide-departmental', checked.toString());
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Tarjetas</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Gestiona tus tarjetas de crédito</p>
          </div>
        </div>
        <CardSkeletonGrid count={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Tarjetas</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Gestiona tus tarjetas de crédito</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="hidden sm:flex w-full sm:w-auto">
          {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showForm ? 'Cancelar' : 'Nueva Tarjeta'}
        </Button>
      </div>

      {/* Form */}
      <AnimatePresence mode="wait">
        {showForm && (
          <motion.div
            key="card-form"
            initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
            animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
            transition={{ duration: 0.3 }}
          >
            <Card className="shadow-md border-border">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
            <CardTitle className="text-xl sm:text-2xl">{editingCard ? 'Editar' : 'Nueva'} Tarjeta</CardTitle>
            <CardDescription className="text-sm">
              {editingCard ? 'Actualiza los datos de tu tarjeta' : 'Agrega una nueva tarjeta de crédito'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Sección 1: Información Básica */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-semibold border-b pb-2 text-primary flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Información Básica
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre de la tarjeta *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej: BBVA Platino"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bankId">Banco emisor *</Label>
                    <Select
                      value={formData.bankId}
                      onValueChange={(value) => setFormData({ ...formData, bankId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un banco" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((bank) => (
                          <SelectItem key={bank.id} value={bank.id}>
                            {bank.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {banks.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Primero agrega bancos en la sección "Bancos"
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="owner">A quién pertenece *</Label>
                    <Select
                      value={formData.owner}
                      onValueChange={(value) => setFormData({ ...formData, owner: value as CardOwner })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona propietario" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Gustavo">Gustavo</SelectItem>
                        <SelectItem value="Sandra">Sandra</SelectItem>
                        <SelectItem value="Guatever">Guatever</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Sección 2: Números y Cuentas */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-semibold border-b pb-2 text-primary flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Números y Cuentas
                </h3>

                {/* Tarjetas Físicas - Lista dinámica */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Tarjetas Físicas
                      {formData.cardType !== 'Departamental' && (
                        <Badge
                          variant={formData.cardType.toLowerCase() as any}
                          className="ml-2"
                        >
                          {formData.cardType}
                        </Badge>
                      )}
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newCard: PhysicalCard = {
                          id: crypto.randomUUID(),
                          number: '',
                          label: '',
                        };
                        setFormData({
                          ...formData,
                          physicalCards: [...(formData.physicalCards || []), newCard],
                        });
                      }}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar tarjeta
                    </Button>
                  </div>

                  {(!formData.physicalCards || formData.physicalCards.length === 0) && (
                    <div className="bg-muted/50 rounded-lg p-4 text-center border border-dashed">
                      <CreditCard className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No hay tarjetas físicas registradas
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Haz clic en "Agregar tarjeta" para añadir una
                      </p>
                    </div>
                  )}

                  {formData.physicalCards && formData.physicalCards.length > 0 && (
                    <div className="space-y-3">
                      {formData.physicalCards.map((physicalCard, index) => (
                        <div
                          key={physicalCard.id}
                          className="p-3 bg-muted/30 rounded-lg border space-y-2"
                        >
                          {/* Header con etiqueta y boton eliminar */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1">
                              <Label className="text-xs text-muted-foreground">Etiqueta (titular)</Label>
                              <Input
                                value={physicalCard.label}
                                onChange={(e) => {
                                  const updatedCards = [...(formData.physicalCards || [])];
                                  updatedCards[index] = { ...physicalCard, label: e.target.value };
                                  setFormData({ ...formData, physicalCards: updatedCards });
                                }}
                                placeholder="Ej: Gustavo, Sandra, Adicional"
                                className="mt-1"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const updatedCards = formData.physicalCards?.filter((_, i) => i !== index) || [];

                                // Recalculate cardType and lastDigits
                                let cardType = formData.cardType;
                                let lastDigits = formData.lastDigits;
                                if (updatedCards.length > 0) {
                                  const firstNumber = unformatCardNumber(updatedCards[0].number);
                                  if (firstNumber.length >= 4) {
                                    cardType = detectCardType(firstNumber);
                                    lastDigits = firstNumber.slice(-4);
                                  }
                                } else {
                                  const digitalCleaned = unformatCardNumber(formData.digitalCardNumber || '');
                                  if (digitalCleaned.length >= 4) {
                                    cardType = detectCardType(digitalCleaned);
                                    lastDigits = digitalCleaned.slice(-4);
                                  }
                                }

                                setFormData({
                                  ...formData,
                                  physicalCards: updatedCards,
                                  cardType,
                                  lastDigits,
                                });
                              }}
                              className="h-8 w-8 p-0 mt-5 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Numeros de tarjeta fisica y digital */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                Tarjeta Fisica
                              </Label>
                              <InputWithCopy
                                value={physicalCard.number}
                                onChange={(value) => {
                                  const cleaned = unformatCardNumber(value);
                                  const updatedCards = [...(formData.physicalCards || [])];
                                  updatedCards[index] = { ...physicalCard, number: value };

                                  // Auto-detect card type from first card
                                  let cardType = formData.cardType;
                                  let lastDigits = formData.lastDigits;
                                  if (index === 0 && cleaned.length >= 4) {
                                    cardType = detectCardType(cleaned);
                                    lastDigits = cleaned.slice(-4);
                                  } else if (index === 0 && cleaned.length < 4) {
                                    // Check other sources for lastDigits
                                    const digitalCleaned = unformatCardNumber(formData.digitalCardNumber || '');
                                    if (digitalCleaned.length >= 4) {
                                      cardType = detectCardType(digitalCleaned);
                                      lastDigits = digitalCleaned.slice(-4);
                                    }
                                  }

                                  setFormData({
                                    ...formData,
                                    physicalCards: updatedCards,
                                    cardType,
                                    lastDigits,
                                  });
                                }}
                                placeholder="1234 5678 9012 3456"
                                icon={CreditCard}
                                maxLength={19}
                                formatValue={formatCardNumber}
                                unformatValue={unformatCardNumber}
                                copyMessage="Numero de tarjeta fisica copiado"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                <Smartphone className="h-3 w-3" />
                                Tarjeta Digital
                              </Label>
                              <InputWithCopy
                                value={physicalCard.digitalNumber || ''}
                                onChange={(value) => {
                                  const updatedCards = [...(formData.physicalCards || [])];
                                  updatedCards[index] = { ...physicalCard, digitalNumber: value };
                                  setFormData({ ...formData, physicalCards: updatedCards });
                                }}
                                placeholder="1234 5678 9012 3456"
                                icon={Smartphone}
                                maxLength={19}
                                formatValue={formatCardNumber}
                                unformatValue={unformatCardNumber}
                                copyMessage="Numero de tarjeta digital copiado"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {formData.lastDigits && (
                    <p className="text-xs text-muted-foreground">
                      Últimos 4 dígitos (principal): **** {formData.lastDigits}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="digitalCardNumber">
                      Número tarjeta digital
                      {(!formData.physicalCards || formData.physicalCards.length === 0) && formData.cardType !== 'Departamental' && (
                        <Badge
                          variant={formData.cardType.toLowerCase() as any}
                          className="ml-2"
                        >
                          {formData.cardType}
                        </Badge>
                      )}
                    </Label>
                    <InputWithCopy
                      id="digitalCardNumber"
                      value={formData.digitalCardNumber || ''}
                      onChange={handleDigitalCardNumberChange}
                      placeholder="1234 5678 9012 3456"
                      icon={Smartphone}
                      maxLength={19}
                      formatValue={formatCardNumber}
                      unformatValue={unformatCardNumber}
                      copyMessage="Número de tarjeta digital copiado"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="clabeAccount">Cuenta CLABE (18 dígitos)</Label>
                    <InputWithCopy
                      id="clabeAccount"
                      value={formData.clabeAccount || ''}
                      onChange={(value) => setFormData({ ...formData, clabeAccount: value })}
                      placeholder="123 456 789 012 345 678"
                      icon={Building2}
                      maxLength={23}
                      formatValue={formatCLABE}
                      unformatValue={unformatCLABE}
                      copyMessage="Cuenta CLABE copiada"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Límites y Fechas */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-semibold border-b pb-2 text-primary flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Límites y Fechas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="creditLimit">Límite de crédito *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                        $
                      </span>
                      <Input
                        id="creditLimit"
                        type="text"
                        value={isEditingCreditLimit ? creditLimitInput : formatCurrencyInput(formData.creditLimit.toString())}
                        onChange={(e) => {
                          setCreditLimitInput(e.target.value);
                        }}
                        onFocus={(e) => {
                          setIsEditingCreditLimit(true);
                          setCreditLimitInput(formData.creditLimit > 0 ? formData.creditLimit.toString() : '');
                          setTimeout(() => e.target.select(), 0);
                        }}
                        onBlur={() => {
                          const value = parseCurrencyInput(creditLimitInput);
                          setFormData({ ...formData, creditLimit: value });
                          setIsEditingCreditLimit(false);
                        }}
                        placeholder="0.00"
                        className="pl-7"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="availableCredit">Crédito disponible *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                        $
                      </span>
                      <Input
                        id="availableCredit"
                        type="text"
                        value={isEditingAvailableCredit ? availableCreditInput : formatCurrencyInput(formData.availableCredit.toString())}
                        onChange={(e) => {
                          setAvailableCreditInput(e.target.value);
                        }}
                        onFocus={(e) => {
                          setIsEditingAvailableCredit(true);
                          setAvailableCreditInput(formData.availableCredit > 0 ? formData.availableCredit.toString() : '');
                          setTimeout(() => e.target.select(), 0);
                        }}
                        onBlur={() => {
                          const value = parseCurrencyInput(availableCreditInput);
                          setFormData({ ...formData, availableCredit: value });
                          setIsEditingAvailableCredit(false);
                        }}
                        placeholder="0.00"
                        className="pl-7"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currentBalance">
                      Saldo actual
                      <span className="text-xs text-muted-foreground ml-2">(calculado)</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                        $
                      </span>
                      <Input
                        id="currentBalance"
                        type="text"
                        value={formatCurrencyInput(formData.currentBalance.toString())}
                        disabled
                        className="pl-7 bg-muted"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Límite - Disponible = Saldo
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="closingDay">Día de corte *</Label>
                    <Input
                      id="closingDay"
                      type="text"
                      inputMode="numeric"
                      value={isEditingClosingDay ? closingDayInput : (formData.closingDay > 0 ? formData.closingDay.toString() : '')}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setClosingDayInput(value);
                      }}
                      onFocus={(e) => {
                        setIsEditingClosingDay(true);
                        setClosingDayInput(formData.closingDay > 0 ? formData.closingDay.toString() : '');
                        setTimeout(() => e.target.select(), 0);
                      }}
                      onBlur={() => {
                        const num = parseInt(closingDayInput);
                        const value = !isNaN(num) && num >= 1 && num <= 31 ? num : 0;
                        setFormData({ ...formData, closingDay: value });
                        setIsEditingClosingDay(false);
                      }}
                      placeholder="1-31"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dueDay">Día de pago *</Label>
                    <Input
                      id="dueDay"
                      type="text"
                      inputMode="numeric"
                      value={isEditingDueDay ? dueDayInput : (formData.dueDay > 0 ? formData.dueDay.toString() : '')}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setDueDayInput(value);
                      }}
                      onFocus={(e) => {
                        setIsEditingDueDay(true);
                        setDueDayInput(formData.dueDay > 0 ? formData.dueDay.toString() : '');
                        setTimeout(() => e.target.select(), 0);
                      }}
                      onBlur={() => {
                        const num = parseInt(dueDayInput);
                        const value = !isNaN(num) && num >= 1 && num <= 31 ? num : 0;
                        setFormData({ ...formData, dueDay: value });
                        setIsEditingDueDay(false);
                      }}
                      placeholder="1-31"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Sección 4: Comentarios */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-semibold border-b pb-2 text-primary flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Comentarios
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="comments">Notas o comentarios</Label>
                  <Textarea
                    id="comments"
                    value={formData.comments || ''}
                    onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                    placeholder="Información adicional sobre la tarjeta (ej: datos de pago, referencias, etc.)"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2">
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
                    editingCard ? 'Actualizar' : 'Guardar'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de búsqueda, ordenamiento y vista */}
      {cards.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre, banco, últimos dígitos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="w-full sm:w-40">
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Nombre A-Z</SelectItem>
                    <SelectItem value="balance">Saldo (Mayor a Menor)</SelectItem>
                    <SelectItem value="credit">Crédito Disponible</SelectItem>
                    <SelectItem value="bank">Banco</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <ViewToggle value={viewMode} onChange={handleViewModeChange} />
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0">
              <Label htmlFor="hide-departmental" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
                Ocultar departamentales
              </Label>
              <Switch
                id="hide-departmental"
                checked={hideDepartmental}
                onCheckedChange={handleHideDepartmentalChange}
              />
            </div>
            {searchTerm && (
              <p className="text-sm text-muted-foreground mt-3">
                {filteredAndSortedCards.length} {filteredAndSortedCards.length === 1 ? 'tarjeta encontrada' : 'tarjetas encontradas'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cards List */}
      {cards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay tarjetas registradas</p>
            <p className="text-sm text-muted-foreground">Haz clic en "Nueva Tarjeta" para agregar una</p>
          </CardContent>
        </Card>
      ) : filteredAndSortedCards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No se encontraron tarjetas</p>
            <p className="text-sm text-muted-foreground">Intenta con otro término de búsqueda</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Vista Grid */}
          {viewMode === 'grid' && (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paginatedCards.map((card) => (
                <CardGridItem
                  key={card.id}
                  card={card}
                  bankName={getBankName(card.bankId)}
                  onView={handleView}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {/* Vista Lista */}
          {viewMode === 'list' && (
            <div className="space-y-2">
              {paginatedCards.map((card) => (
                <CardListItem
                  key={card.id}
                  card={card}
                  bankName={getBankName(card.bankId)}
                  onView={handleView}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredAndSortedCards.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={handleItemsPerPageChange}
              className="mt-6"
            />
          )}
        </>
      )}

      {/* Botón flotante fijo - Solo en móvil */}
      <Button
        onClick={() => setShowForm(!showForm)}
        className="sm:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        {showForm ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </Button>

      {/* Sheet de vista de tarjeta */}
      <CardDetailSheet
        card={viewingCard}
        open={!!viewingCard}
        onOpenChange={(open) => !open && setViewingCard(null)}
        banks={banks}
        allCards={cards}
        onEdit={handleEditFromView}
      >
        {/* Pagos Programados */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">Pagos Programados</h4>
            <Badge variant="secondary">{cardPayments.length}</Badge>
          </div>

          {loadingPayments ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : cardPayments.length === 0 ? (
            <div className="bg-muted/50 p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">No hay pagos programados para esta tarjeta</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cardPayments.map((payment) => (
                <div
                  key={payment.id}
                  className={`border rounded-lg p-3 transition-all ${
                    payment.status === 'paid' ? 'bg-muted/50 opacity-70' : ''
                  } ${payment.status === 'partial' ? 'border-blue-400 bg-blue-50/30' : ''}`}
                >
                  <div className="space-y-2">
                    {/* Encabezado del pago */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h5 className="font-semibold text-sm break-words">{payment.description}</h5>
                        <p className="text-xs text-muted-foreground">
                          {payment.dueDate.toLocaleDateString('es-ES')}
                        </p>
                        {payment.notes && (
                          <p className="text-xs text-muted-foreground italic mt-1">
                            📝 {payment.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-sm">{formatCurrency(payment.amount)}</p>
                        {getStatusBadge(payment.status)}
                      </div>
                    </div>

                    {/* Progress bar para pagos parciales */}
                    {payment.status === 'partial' && (payment.paidAmount || 0) > 0 && (
                      <div className="bg-white rounded-lg p-2 border border-blue-200">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Progreso</span>
                          <span className="font-semibold text-blue-600">
                            {Math.round(((payment.paidAmount || 0) / payment.amount) * 100)}%
                          </span>
                        </div>
                        <Progress
                          value={((payment.paidAmount || 0) / payment.amount) * 100}
                          className="h-1.5 mb-1"
                        />
                        <div className="flex justify-between text-xs">
                          <span className="text-green-600 font-medium">
                            {formatCurrency(payment.paidAmount || 0)}
                          </span>
                          <span className="text-blue-600 font-medium">
                            {formatCurrency(payment.remainingAmount || 0)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Historial de pagos parciales */}
                    {payment.partialPayments && payment.partialPayments.length > 0 && (
                      <div className="bg-muted/30 rounded-lg p-2 border">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold">Historial de abonos</span>
                          <Badge variant="secondary" className="text-xs h-5">
                            {payment.partialPayments.length}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          {payment.partialPayments.map((partial) => (
                            <div
                              key={partial.id}
                              className="flex items-center justify-between text-xs bg-white rounded p-2 border"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-green-600">
                                  {formatCurrency(partial.amount)}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  {new Date(partial.paidDate).toLocaleDateString('es-ES')}
                                  {' • '}{partial.paidByName}
                                </p>
                                {partial.notes && (
                                  <p className="text-muted-foreground italic text-xs mt-1">
                                    {partial.notes}
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePartialPayment(payment, partial.id)}
                                className="h-6 w-6 p-0 ml-2 flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Botones de acción */}
                    {(payment.status === 'pending' || payment.status === 'partial') && (
                      <div className="flex gap-2 pt-2">
                        {payment.status === 'pending' ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsPaid(payment)}
                              className="flex-1 h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Pagado
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenPartialPayment(payment)}
                              className="flex-1 h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Parcial
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenPartialPayment(payment)}
                              className="flex-1 h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Abonar más
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsPaid(payment)}
                              className="flex-1 h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Completar
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardDetailSheet>

      {/* Modal de Pago Parcial */}
      {showPartialPaymentModal && editingPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <Card className="w-full max-w-md border-blue-600 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-500/10 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                Registrar Pago Parcial
              </CardTitle>
              <CardDescription>{editingPayment.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Información del pago */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monto total:</span>
                  <span className="font-semibold">{formatCurrency(editingPayment.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pagado hasta ahora:</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(editingPayment.paidAmount || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Restante:</span>
                  <span className="font-semibold text-blue-600">
                    {formatCurrency(editingPayment.remainingAmount ?? editingPayment.amount)}
                  </span>
                </div>

                {/* Progress bar */}
                {(editingPayment.paidAmount || 0) > 0 && (
                  <div className="mt-3">
                    <Progress
                      value={((editingPayment.paidAmount || 0) / editingPayment.amount) * 100}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground text-center mt-1">
                      {Math.round(((editingPayment.paidAmount || 0) / editingPayment.amount) * 100)}% completado
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
                  Máximo: {formatCurrency(editingPayment.remainingAmount ?? editingPayment.amount)}
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
                    setEditingPayment(null);
                  }}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSavePartialPayment}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Registrar Abono
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
