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
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Bank, BankFormData } from '@/lib/types';
import { Building2, Edit, Trash2, Plus, X, Search, Loader2 } from 'lucide-react';

export function Banks() {
  const { currentUser } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'code'>('name');
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
        where('householdId', '==', currentUser.householdId)
      );
      const snapshot = await getDocs(banksQuery);
      const banksData = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Bank[];

      setBanks(banksData);
    } catch (error) {
      console.error('Error fetching banks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || saving) return;

    setSaving(true);
    try {
      if (editingBank) {
        // Update
        await updateDoc(doc(db, 'banks', editingBank.id), {
          ...formData,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.id,
          updatedByName: currentUser.name,
        });
        toast.success('Banco actualizado exitosamente');
      } else {
        // Create
        await addDoc(collection(db, 'banks'), {
          ...formData,
          userId: currentUser.id, // Mantener por compatibilidad
          householdId: currentUser.householdId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: currentUser.id,
          createdByName: currentUser.name,
          updatedBy: currentUser.id,
          updatedByName: currentUser.name,
        });
        toast.success('Banco creado exitosamente');
      }

      resetForm();
      await fetchBanks();
    } catch (error) {
      console.error('Error saving bank:', error);
      toast.error('Error al guardar el banco');
    } finally {
      setSaving(false);
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
      toast.success('Banco eliminado exitosamente');
      await fetchBanks();
    } catch (error) {
      console.error('Error deleting bank:', error);
      toast.error('Error al eliminar el banco');
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

  // Filter and sort banks
  const filteredAndSortedBanks = useMemo(() => {
    let filtered = banks;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (bank) =>
          bank.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (bank.code && bank.code.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'code':
          return (a.code || '').localeCompare(b.code || '');
        default:
          return 0;
      }
    });

    return sorted;
  }, [banks, searchTerm, sortBy]);

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
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Bancos</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Gestiona los bancos emisores de tus tarjetas</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="hidden sm:flex w-full sm:w-auto">
          {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showForm ? 'Cancelar' : 'Nuevo Banco'}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">{editingBank ? 'Editar' : 'Nuevo'} Banco</CardTitle>
            <CardDescription className="text-sm">
              {editingBank ? 'Actualiza los datos' : 'Agrega un nuevo banco emisor'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    editingBank ? 'Actualizar' : 'Guardar'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search and Filter */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar bancos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sortBy} onValueChange={(value: 'name' | 'code') => setSortBy(value)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Ordenar por nombre</SelectItem>
                <SelectItem value="code">Ordenar por código</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {searchTerm && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {filteredAndSortedBanks.length} de {banks.length} bancos
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm('')}
                className="h-auto p-1"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Banks List */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredAndSortedBanks.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              {banks.length === 0 ? (
                <>
                  <p className="text-muted-foreground">No hay bancos registrados</p>
                  <p className="text-sm text-muted-foreground">Haz clic en "Nuevo Banco" para agregar uno</p>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">No se encontraron bancos</p>
                  <p className="text-sm text-muted-foreground">Intenta con otros términos de búsqueda</p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredAndSortedBanks.map((bank) => (
            <Card key={bank.id}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1 w-full sm:w-auto min-w-0">
                    <CardTitle className="text-base sm:text-lg flex items-center break-words">
                      <Building2 className="h-5 w-5 mr-2 text-primary flex-shrink-0" />
                      {bank.name}
                    </CardTitle>
                    {bank.code && (
                      <CardDescription className="text-sm">Código: {bank.code}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(bank)} className="flex-1 sm:flex-none min-h-[44px]">
                      <Edit className="h-4 w-4 sm:mr-0 mr-1" />
                      <span className="sm:hidden">Editar</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(bank.id)} className="flex-1 sm:flex-none min-h-[44px]">
                      <Trash2 className="h-4 w-4 text-destructive sm:mr-0 mr-1" />
                      <span className="sm:hidden">Eliminar</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
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
    </div>
  );
}
