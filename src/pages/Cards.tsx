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
import { useBanks } from '@/hooks/useBanks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputWithCopy } from '@/components/ui/input-with-copy';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyInput,
  detectCardType,
  isValidCLABE,
  getCardIcon,
  formatCardNumber,
  unformatCardNumber,
  formatCLABE,
  unformatCLABE,
} from '@/lib/utils';
import type { Card as CardType, CardFormData, CardOwner } from '@/lib/types';
import {
  CreditCard,
  Edit,
  Trash2,
  Plus,
  X,
  Smartphone,
  Building2,
  DollarSign,
  User,
} from 'lucide-react';

export function Cards() {
  const { currentUser } = useAuth();
  const { banks } = useBanks();
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<CardType | null>(null);
  const [formData, setFormData] = useState<CardFormData>({
    name: '',
    lastDigits: '',
    closingDay: 1,
    dueDay: 1,
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
        where('userId', '==', currentUser.id)
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
    const cardType = detectCardType(cleaned);
    const lastDigits = cleaned.slice(-4);

    setFormData({
      ...formData,
      physicalCardNumber: value,
      cardType,
      lastDigits: lastDigits || formData.lastDigits,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (formData.clabeAccount && !isValidCLABE(formData.clabeAccount)) {
      alert('La cuenta CLABE debe tener exactamente 18 dígitos');
      return;
    }

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
        });
      } else {
        await addDoc(collection(db, 'cards'), {
          ...dataToSave,
          userId: currentUser.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      resetForm();
      await fetchCards();
    } catch (error) {
      console.error('Error saving card:', error);
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
      await fetchCards();
    } catch (error) {
      console.error('Error deleting card:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      lastDigits: '',
      closingDay: 1,
      dueDay: 1,
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
  };

  const getBankName = (bankId: string) => {
    const bank = banks.find((b) => b.id === bankId);
    return bank?.name || 'Sin banco';
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Tarjetas</h2>
          <p className="text-muted-foreground">Gestiona tus tarjetas de crédito</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showForm ? 'Cancelar' : 'Nueva Tarjeta'}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="shadow-md border-border">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
            <CardTitle className="text-2xl">{editingCard ? 'Editar' : 'Nueva'} Tarjeta</CardTitle>
            <CardDescription>
              {editingCard ? 'Actualiza los datos de tu tarjeta' : 'Agrega una nueva tarjeta de crédito'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Sección 1: Información Básica */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2 text-primary flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Información Básica
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <h3 className="text-lg font-semibold border-b pb-2 text-primary flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Números y Cuentas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Label htmlFor="digitalCardNumber">Número tarjeta digital</Label>
                    <InputWithCopy
                      id="digitalCardNumber"
                      value={formData.digitalCardNumber || ''}
                      onChange={(value) => setFormData({ ...formData, digitalCardNumber: value })}
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
                <h3 className="text-lg font-semibold border-b pb-2 text-primary flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Límites y Fechas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      type="number"
                      min="1"
                      max="31"
                      value={formData.closingDay}
                      onChange={(e) => setFormData({ ...formData, closingDay: parseInt(e.target.value) || 1 })}
                      onFocus={(e) => e.target.select()}
                      placeholder="1-31"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dueDay">Día de pago *</Label>
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
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingCard ? 'Actualizar' : 'Guardar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Cards List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay tarjetas registradas</p>
              <p className="text-sm text-muted-foreground">Haz clic en "Nueva Tarjeta" para agregar una</p>
            </CardContent>
          </Card>
        ) : (
          cards.map((card) => (
            <Card
              key={card.id}
              className="relative hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-border"
            >
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow-sm">
                <img src={getCardIcon(card.cardType)} alt={card.cardType} className="h-8 w-auto" />
              </div>

              <CardHeader className="pb-3">
                <div className="flex items-start justify-between pr-12">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-bold">{card.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="font-mono font-medium">**** {card.lastDigits}</span>
                      <Badge variant="outline" className="text-xs font-medium">
                        {card.owner}
                      </Badge>
                    </CardDescription>
                    <div className="flex items-center gap-2 mt-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground font-medium">
                        {getBankName(card.bankId)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Saldo actual</span>
                    <span className="font-semibold">{formatCurrency(card.currentBalance)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Crédito disponible</span>
                    <span className="font-semibold text-green-600">{formatCurrency(card.availableCredit)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Límite</span>
                    <span>{formatCurrency(card.creditLimit)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <div className="text-sm">
                    <span className="text-muted-foreground block">Día de corte</span>
                    <span className="font-medium">{card.closingDay}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground block">Día de pago</span>
                    <span className="font-medium">{card.dueDay}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="pt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{
                        width: card.creditLimit > 0
                          ? `${Math.min((card.currentBalance / card.creditLimit) * 100, 100)}%`
                          : '0%',
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-right">
                    {card.creditLimit > 0
                      ? `${((card.currentBalance / card.creditLimit) * 100).toFixed(1)}% utilizado`
                      : '0% utilizado'}
                  </p>
                </div>

                <div className="flex justify-end space-x-1 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(card)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(card.id)}>
                    <Trash2 className="h-4 w-4 mr-1 text-destructive" />
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
