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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useBanks } from '@/hooks/useBanks';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputWithCopy } from '@/components/ui/input-with-copy';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
import type { Card as CardType, CardFormData, CardOwner } from '@/lib/types';
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
} from 'lucide-react';
import { ViewToggle, type ViewMode } from '@/components/ui/view-toggle';
import { Pagination } from '@/components/ui/pagination';
import { CardGridItem } from '@/components/cards/CardGridItem';
import { CardListItem } from '@/components/cards/CardListItem';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatCurrency, getCardIcon } from '@/lib/utils';

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
    physicalCardNumber: '',
    cardType: 'Unknown',
    digitalCardNumber: '',
    clabeAccount: '',
    owner: 'Gustavo',
    bankId: '',
    availableCredit: 0,
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
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'bank' | 'credit'>('name');

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
        cardType: doc.data().cardType || 'Unknown',
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

  const handleCardNumberChange = (value: string) => {
    const cleaned = unformatCardNumber(value);
    const digitalCleaned = unformatCardNumber(formData.digitalCardNumber || '');

    let cardType = formData.cardType;
    let lastDigits = formData.lastDigits;

    if (cleaned.length >= 4) {
      // Si hay número físico, usarlo para detectar tipo y últimos dígitos
      cardType = detectCardType(cleaned);
      lastDigits = cleaned.slice(-4);
    } else if (digitalCleaned.length >= 4) {
      // Si no hay físico pero sí digital, usar digital
      cardType = detectCardType(digitalCleaned);
      lastDigits = digitalCleaned.slice(-4);
    }

    setFormData({
      ...formData,
      physicalCardNumber: value,
      cardType,
      lastDigits,
    });
  };

  const handleDigitalCardNumberChange = (value: string) => {
    const cleaned = unformatCardNumber(value);
    const physicalCleaned = unformatCardNumber(formData.physicalCardNumber || '');

    // Solo usar digital para tipo y lastDigits si NO hay tarjeta física
    const shouldUseDigital = physicalCleaned.length < 4 && cleaned.length >= 4;

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
      const dataToSave = {
        ...formData,
        physicalCardNumber: unformatCardNumber(formData.physicalCardNumber || ''),
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

  const handleEditFromView = () => {
    if (viewingCard) {
      setViewingCard(null);
      handleEdit(viewingCard);
    }
  };

  const handleEdit = (card: CardType) => {
    setEditingCard(card);
    setFormData({
      name: card.name,
      lastDigits: card.lastDigits,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      creditLimit: card.creditLimit,
      currentBalance: card.currentBalance,
      physicalCardNumber: card.physicalCardNumber || '',
      cardType: card.cardType,
      digitalCardNumber: card.digitalCardNumber || '',
      clabeAccount: card.clabeAccount || '',
      owner: card.owner,
      bankId: card.bankId,
      availableCredit: card.availableCredit,
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
      cardType: 'Unknown',
      digitalCardNumber: '',
      clabeAccount: '',
      owner: 'Gustavo',
      bankId: '',
      availableCredit: 0,
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

    // Filtrar por búsqueda
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(
        (card) =>
          card.name.toLowerCase().includes(search) ||
          card.lastDigits.includes(search) ||
          getBankName(card.bankId).toLowerCase().includes(search) ||
          card.owner.toLowerCase().includes(search)
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
  }, [cards, searchTerm, sortBy, banks]);

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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="physicalCardNumber">
                      Número tarjeta física
                      {formData.cardType !== 'Unknown' && (
                        <Badge
                          variant={formData.cardType.toLowerCase() as any}
                          className="ml-2"
                        >
                          {formData.cardType}
                        </Badge>
                      )}
                    </Label>
                    <InputWithCopy
                      id="physicalCardNumber"
                      value={formData.physicalCardNumber || ''}
                      onChange={handleCardNumberChange}
                      placeholder="1234 5678 9012 3456"
                      icon={CreditCard}
                      maxLength={19}
                      formatValue={formatCardNumber}
                      unformatValue={unformatCardNumber}
                      copyMessage="Número de tarjeta física copiado"
                    />
                    {formData.lastDigits && (
                      <p className="text-xs text-muted-foreground">
                        Últimos 4 dígitos: **** {formData.lastDigits}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="digitalCardNumber">
                      Número tarjeta digital
                      {!formData.physicalCardNumber && formData.cardType !== 'Unknown' && (
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
      <Sheet open={!!viewingCard} onOpenChange={() => setViewingCard(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {viewingCard && (
            <>
              <SheetHeader className="text-left">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-50 p-2 rounded-lg">
                    <img src={getCardIcon(viewingCard.cardType)} alt={viewingCard.cardType} className="h-8 w-auto" />
                  </div>
                  <div>
                    <SheetTitle className="text-lg">{viewingCard.name}</SheetTitle>
                    <SheetDescription className="font-mono">**** {viewingCard.lastDigits}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Información básica */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Información</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">Propietario</p>
                      <p className="font-medium">{viewingCard.owner}</p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">Banco</p>
                      <p className="font-medium">{getBankName(viewingCard.bankId)}</p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <p className="font-medium">{viewingCard.cardType}</p>
                    </div>
                  </div>
                </div>

                {/* Números de tarjeta */}
                {(viewingCard.physicalCardNumber || viewingCard.digitalCardNumber || viewingCard.clabeAccount) && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Números</h4>
                    <div className="space-y-2">
                      {viewingCard.physicalCardNumber && (
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Tarjeta Física</p>
                          <p className="font-mono text-sm">{formatCardNumber(viewingCard.physicalCardNumber)}</p>
                        </div>
                      )}
                      {viewingCard.digitalCardNumber && (
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Tarjeta Digital</p>
                          <p className="font-mono text-sm">{formatCardNumber(viewingCard.digitalCardNumber)}</p>
                        </div>
                      )}
                      {viewingCard.clabeAccount && (
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">CLABE</p>
                          <p className="font-mono text-sm">{formatCLABE(viewingCard.clabeAccount)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Límites y saldos */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Límites y Saldos</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-muted-foreground">Límite de Crédito</span>
                      <span className="font-semibold">{formatCurrency(viewingCard.creditLimit)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-muted-foreground">Disponible</span>
                      <span className="font-semibold text-green-600">{formatCurrency(viewingCard.availableCredit)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-muted-foreground">Saldo Actual</span>
                      <span className="font-semibold">{formatCurrency(viewingCard.currentBalance)}</span>
                    </div>
                  </div>
                </div>

                {/* Fechas */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Fechas de Pago</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Día de Corte</p>
                      <p className="text-2xl font-bold">{viewingCard.closingDay}</p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Día de Pago</p>
                      <p className="text-2xl font-bold">{viewingCard.dueDay}</p>
                    </div>
                  </div>
                </div>
              </div>

              <SheetFooter className="mt-6">
                <Button onClick={handleEditFromView} className="w-full">
                  Editar Tarjeta
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
