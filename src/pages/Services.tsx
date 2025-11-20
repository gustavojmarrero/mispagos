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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Service, ServiceFormData, PaymentMethod } from '@/lib/types';
import { Store, Edit, Trash2, Plus, X, CreditCard, Banknote } from 'lucide-react';

export function Services() {
  const { currentUser } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>({
    name: '',
    paymentMethod: 'transfer',
  });

  useEffect(() => {
    fetchServices();
  }, [currentUser]);

  const fetchServices = async () => {
    if (!currentUser) return;

    try {
      const servicesQuery = query(
        collection(db, 'services'),
        where('householdId', '==', currentUser.householdId)
      );
      const snapshot = await getDocs(servicesQuery);
      const servicesData = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Service[];

      setServices(servicesData.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      if (editingService) {
        // Update
        await updateDoc(doc(db, 'services', editingService.id), {
          ...formData,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.id,
          updatedByName: currentUser.name,
        });
      } else {
        // Create
        await addDoc(collection(db, 'services'), {
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
      }

      resetForm();
      await fetchServices();
    } catch (error) {
      console.error('Error saving service:', error);
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      paymentMethod: service.paymentMethod,
    });
    setShowForm(true);
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm('¿Estás seguro de eliminar este servicio?')) return;

    try {
      await deleteDoc(doc(db, 'services', serviceId));
      await fetchServices();
    } catch (error) {
      console.error('Error deleting service:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      paymentMethod: 'transfer',
    });
    setEditingService(null);
    setShowForm(false);
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    return method === 'card' ? 'Tarjeta' : 'Transferencia';
  };

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    return method === 'card' ? CreditCard : Banknote;
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
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Servicios</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Gestiona los servicios que pagas mensualmente</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="hidden sm:flex w-full sm:w-auto">
          {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showForm ? 'Cancelar' : 'Nuevo Servicio'}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="shadow-md border-border">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
            <CardTitle className="text-xl sm:text-2xl">{editingService ? 'Editar' : 'Nuevo'} Servicio</CardTitle>
            <CardDescription className="text-sm">
              {editingService ? 'Actualiza la información del servicio' : 'Agrega un nuevo servicio'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del servicio *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Netflix, Internet, Luz"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Método de pago *</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(value) => setFormData({ ...formData, paymentMethod: value as PaymentMethod })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona método de pago" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Transferencia/Efectivo</SelectItem>
                    <SelectItem value="card">Tarjeta de Crédito</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Indica cómo pagas normalmente este servicio
                </p>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button type="submit" className="w-full sm:w-auto">
                  {editingService ? 'Actualizar' : 'Guardar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Services List */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Store className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay servicios registrados</p>
              <p className="text-sm text-muted-foreground">Haz clic en "Nuevo Servicio" para agregar uno</p>
            </CardContent>
          </Card>
        ) : (
          services.map((service) => {
            const PaymentIcon = getPaymentMethodIcon(service.paymentMethod);
            return (
              <Card
                key={service.id}
                className="relative hover:shadow-lg transition-all duration-300 sm:hover:scale-[1.02] border-border"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Store className="h-5 w-5 text-primary flex-shrink-0" />
                        <CardTitle className="text-base sm:text-lg font-bold break-words">{service.name}</CardTitle>
                      </div>
                      <CardDescription className="flex items-center gap-2 mt-2 text-sm">
                        <PaymentIcon className="h-4 w-4" />
                        <span>{getPaymentMethodLabel(service.paymentMethod)}</span>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="flex flex-col sm:flex-row justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(service)} className="w-full sm:w-auto min-h-[44px]">
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(service.id)} className="w-full sm:w-auto min-h-[44px]">
                      <Trash2 className="h-4 w-4 mr-1 text-destructive" />
                      Eliminar
                    </Button>
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
    </div>
  );
}
