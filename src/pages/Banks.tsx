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
import type { Bank, BankFormData } from '@/lib/types';
import { Building2, Edit, Trash2, Plus, X } from 'lucide-react';

export function Banks() {
  const { currentUser } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [formData, setFormData] = useState<BankFormData>({
    name: '',
    code: '',
  });

  useEffect(() => {
    fetchBanks();
  }, [currentUser]);

  const fetchBanks = async () => {
    if (!currentUser) return;

    try {
      const banksQuery = query(
        collection(db, 'banks'),
        where('userId', '==', currentUser.id)
      );
      const snapshot = await getDocs(banksQuery);
      const banksData = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Bank[];

      setBanks(banksData.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error fetching banks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      if (editingBank) {
        // Update
        await updateDoc(doc(db, 'banks', editingBank.id), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create
        await addDoc(collection(db, 'banks'), {
          ...formData,
          userId: currentUser.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      resetForm();
      await fetchBanks();
    } catch (error) {
      console.error('Error saving bank:', error);
    }
  };

  const handleEdit = (bank: Bank) => {
    setEditingBank(bank);
    setFormData({
      name: bank.name,
      code: bank.code || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (bankId: string) => {
    if (!confirm('¿Estás seguro de eliminar este banco?')) return;

    try {
      // TODO: Verificar que no haya tarjetas asociadas
      await deleteDoc(doc(db, 'banks', bankId));
      await fetchBanks();
    } catch (error) {
      console.error('Error deleting bank:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
    });
    setEditingBank(null);
    setShowForm(false);
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
          <h2 className="text-3xl font-bold tracking-tight">Bancos</h2>
          <p className="text-muted-foreground">Gestiona los bancos emisores de tus tarjetas</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showForm ? 'Cancelar' : 'Nuevo Banco'}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingBank ? 'Editar' : 'Nuevo'} Banco</CardTitle>
            <CardDescription>
              {editingBank ? 'Actualiza los datos' : 'Agrega un nuevo banco emisor'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del banco *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: BBVA Bancomer"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">Código del banco (opcional)</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ej: 012"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingBank ? 'Actualizar' : 'Guardar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Banks List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {banks.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay bancos registrados</p>
              <p className="text-sm text-muted-foreground">Haz clic en "Nuevo Banco" para agregar uno</p>
            </CardContent>
          </Card>
        ) : (
          banks.map((bank) => (
            <Card key={bank.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center">
                      <Building2 className="h-5 w-5 mr-2 text-primary" />
                      {bank.name}
                    </CardTitle>
                    {bank.code && (
                      <CardDescription>Código: {bank.code}</CardDescription>
                    )}
                  </div>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(bank)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(bank.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
