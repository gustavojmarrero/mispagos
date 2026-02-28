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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatShortDate, getDueDateForDay } from '@/lib/utils';
import type { Card as CardType, RecurringExpense, RecurringExpenseFormData } from '@/lib/types';
import { Receipt, Edit, Trash2, Plus, X, ToggleLeft, ToggleRight } from 'lucide-react';

export function Expenses() {
  const { currentUser } = useAuth();
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);
  const [formData, setFormData] = useState<RecurringExpenseFormData>({
    cardId: '',
    description: '',
    amount: 0,
    dueDay: 1,
    isActive: true,
  });

  useEffect(() => {
    fetchData();
  }, [currentUser?.householdId]);

  const fetchData = async () => {
    if (!currentUser) return;

    try {
      // Fetch cards
      const cardsQuery = query(
        collection(db, 'cards'),
        where('userId', '==', currentUser.id)
      );
      const cardsSnapshot = await getDocs(cardsQuery);
      const cardsData = cardsSnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as CardType[];

      // Fetch expenses
      const expensesQuery = query(
        collection(db, 'recurring_expenses'),
        where('userId', '==', currentUser.id)
      );
      const expensesSnapshot = await getDocs(expensesQuery);
      const expensesData = expensesSnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as RecurringExpense[];

      setCards(cardsData);
      setExpenses(
        expensesData.sort((a, b) => {
          // Primero por estado (activos primero)
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          // Luego por día de vencimiento
          return a.dueDay - b.dueDay;
        })
      );
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      if (editingExpense) {
        // Update
        await updateDoc(doc(db, 'recurring_expenses', editingExpense.id), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create
        await addDoc(collection(db, 'recurring_expenses'), {
          ...formData,
          userId: currentUser.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      resetForm();
      await fetchData();
    } catch (error) {
      console.error('Error saving expense:', error);
    }
  };

  const handleEdit = (expense: RecurringExpense) => {
    setEditingExpense(expense);
    setFormData({
      cardId: expense.cardId,
      description: expense.description,
      amount: expense.amount,
      dueDay: expense.dueDay,
      isActive: expense.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = async (expenseId: string) => {
    if (!confirm('¿Estás seguro de eliminar este gasto?')) return;

    try {
      await deleteDoc(doc(db, 'recurring_expenses', expenseId));
      await fetchData();
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const handleToggleActive = async (expense: RecurringExpense) => {
    try {
      await updateDoc(doc(db, 'recurring_expenses', expense.id), {
        isActive: !expense.isActive,
        updatedAt: serverTimestamp(),
      });
      await fetchData();
    } catch (error) {
      console.error('Error toggling expense:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      cardId: '',
      description: '',
      amount: 0,
      dueDay: 1,
      isActive: true,
    });
    setEditingExpense(null);
    setShowForm(false);
  };

  const getCardName = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    return card ? `${card.name} (${card.lastDigits})` : 'Desconocida';
  };

  const totalMonthly = expenses
    .filter((exp) => exp.isActive)
    .reduce((sum, exp) => sum + exp.amount, 0);

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
          <h2 className="text-3xl font-bold tracking-tight">Gastos Recurrentes</h2>
          <p className="text-muted-foreground">
            Total mensual: <span className="font-semibold">{formatCurrency(totalMonthly)}</span>
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showForm ? 'Cancelar' : 'Nuevo Gasto'}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingExpense ? 'Editar' : 'Nuevo'} Gasto Recurrente</CardTitle>
            <CardDescription>
              {editingExpense ? 'Actualiza los datos' : 'Agrega un nuevo gasto recurrente'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cardId">Tarjeta *</Label>
                  <select
                    id="cardId"
                    value={formData.cardId}
                    onChange={(e) => setFormData({ ...formData, cardId: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    required
                  >
                    <option value="">Selecciona una tarjeta</option>
                    {cards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name} (**** {card.lastDigits})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción *</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ej: Netflix Premium"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Monto *</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDay">Día de vencimiento *</Label>
                  <Input
                    id="dueDay"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.dueDay}
                    onChange={(e) => setFormData({ ...formData, dueDay: parseInt(e.target.value) })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="isActive" className="cursor-pointer">
                      Gasto activo
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingExpense ? 'Actualizar' : 'Guardar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Expenses List */}
      <div className="space-y-4">
        {expenses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay gastos recurrentes</p>
              <p className="text-sm text-muted-foreground">Haz clic en "Nuevo Gasto" para agregar uno</p>
            </CardContent>
          </Card>
        ) : (
          expenses.map((expense) => {
            const dueDate = getDueDateForDay(expense.dueDay);

            return (
              <Card key={expense.id} className={expense.isActive ? '' : 'opacity-60'}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center space-x-4 flex-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(expense)}
                      title={expense.isActive ? 'Desactivar' : 'Activar'}
                    >
                      {expense.isActive ? (
                        <ToggleRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-gray-400" />
                      )}
                    </Button>

                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold">{expense.description}</h3>
                        {!expense.isActive && (
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{getCardName(expense.cardId)}</p>
                      <p className="text-xs text-muted-foreground">
                        Vence el día {expense.dueDay} de cada mes · Próximo: {formatShortDate(dueDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right mr-4">
                      <p className="font-bold text-lg">{formatCurrency(expense.amount)}</p>
                    </div>

                    <div className="flex space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(expense)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(expense.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
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
