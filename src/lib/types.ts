// User Types
export interface User {
  id: string;
  email: string;
  name: string;
}

// Card Types
export type CardType = "Visa" | "Mastercard" | "Amex" | "Unknown";
export type CardOwner = "Guatever" | "Sandra" | "Gustavo";

export interface Card {
  id: string;
  userId: string;
  name: string;
  lastDigits: string;
  closingDay: number; // Día del mes (1-31)
  dueDay: number; // Día del mes (1-31)
  creditLimit: number;
  currentBalance: number;
  createdAt: Date;
  updatedAt: Date;
  // Nuevos campos
  physicalCardNumber?: string;
  cardType: CardType;
  digitalCardNumber?: string;
  clabeAccount?: string;
  owner: CardOwner;
  bankId: string;
  availableCredit: number;
}

export interface CardFormData {
  name: string;
  lastDigits: string;
  closingDay: number;
  dueDay: number;
  creditLimit: number;
  currentBalance: number;
  // Nuevos campos
  physicalCardNumber?: string;
  cardType: CardType;
  digitalCardNumber?: string;
  clabeAccount?: string;
  owner: CardOwner;
  bankId: string;
  availableCredit: number;
}

// Bank Types
export interface Bank {
  id: string;
  name: string;
  code?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BankFormData {
  name: string;
  code?: string;
}

// Service Types
export type PaymentMethod = 'card' | 'transfer';

export interface Service {
  id: string;
  name: string;
  paymentMethod: PaymentMethod;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceFormData {
  name: string;
  paymentMethod: PaymentMethod;
}

// Scheduled Payment Types
export type PaymentType = 'card_payment' | 'service_payment';
export type PaymentFrequency = 'monthly' | 'weekly' | 'once';
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Domingo, 5 = Viernes

export interface ScheduledPayment {
  id: string;
  userId: string;
  paymentType: PaymentType;
  frequency?: PaymentFrequency; // Solo para servicios
  description: string;
  amount: number; // Monto variable para ambos tipos
  // Para pagos a tarjetas (fecha específica)
  paymentDate?: Date; // DD/MM/YYYY
  // Para servicios con frecuencia mensual o única
  dueDay?: number; // 1-31
  // Para servicios con frecuencia semanal
  dayOfWeek?: DayOfWeek;
  // Asociación
  cardId?: string; // Si paymentType = 'card_payment'
  serviceId?: string; // Si paymentType = 'service_payment'
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledPaymentFormData {
  paymentType: PaymentType;
  frequency?: PaymentFrequency; // Solo para servicios
  description: string;
  amount: number;
  paymentDate?: Date; // Para tarjetas
  dueDay?: number; // Para servicios
  dayOfWeek?: DayOfWeek; // Para servicios
  cardId?: string;
  serviceId?: string;
  isActive: boolean;
}

// Payment Instance Types (instancias generadas automáticamente)
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface PaymentInstance {
  id: string;
  userId: string;
  scheduledPaymentId: string; // Referencia al template
  paymentType: PaymentType; // Heredado del template
  dueDate: Date; // Fecha específica de este pago
  amount: number; // Puede ser ajustado (diferente al template)
  description: string; // Heredada del template
  status: PaymentStatus;
  // Asociaciones heredadas del template
  cardId?: string;
  serviceId?: string;
  // Información de pago
  paidDate?: Date;
  paidAmount?: number;
  notes?: string; // Para justificar ajustes o anotar razones
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentInstanceFormData {
  amount: number;
  notes?: string;
}

// Payment History Types (para tracking de adelantos)
export interface PaymentHistory {
  id: string;
  userId: string;
  scheduledPaymentId: string;
  amount: number;
  paidDate: Date;
  notes?: string;
  createdAt: Date;
}

export interface PaymentHistoryFormData {
  scheduledPaymentId: string;
  amount: number;
  paidDate: Date;
  notes?: string;
}

// Recurring Expense Types (DEPRECATED - mantener por compatibilidad)
/** @deprecated Use ScheduledPayment instead */
export interface RecurringExpense {
  id: string;
  userId: string;
  cardId: string;
  description: string;
  amount: number;
  dueDay: number; // Día del mes en que vence (1-31)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** @deprecated Use ScheduledPaymentFormData instead */
export interface RecurringExpenseFormData {
  cardId: string;
  description: string;
  amount: number;
  dueDay: number;
  isActive: boolean;
}

// Payment History Types (Fase 2)
export interface Payment {
  id: string;
  userId: string;
  cardId: string;
  expenseId?: string; // Referencia al gasto recurrente si aplica
  amount: number;
  dueDate: Date;
  paidDate?: Date;
  isPaid: boolean;
  notes?: string;
  createdAt: Date;
}

// Dashboard Summary Types
export interface WeeklyPayment {
  cardId: string;
  cardName: string;
  expenses: RecurringExpense[];
  totalAmount: number;
  dueDate: Date;
}

export interface DashboardSummary {
  weeklyPayments: WeeklyPayment[];
  totalWeekly: number;
  totalMonthly: number;
  nextPayments: RecurringExpense[];
  cards: Card[];
}
