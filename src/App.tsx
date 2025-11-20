import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { PrivateRoute } from '@/components/auth/PrivateRoute';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Cards } from '@/pages/Cards';
import { Payments } from '@/pages/Payments';
import { PaymentCalendar } from '@/pages/PaymentCalendar';
import { Services } from '@/pages/Services';
import { Banks } from '@/pages/Banks';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginForm />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="cards" element={<Cards />} />
            <Route path="payments" element={<Payments />} />
            <Route path="calendar" element={<PaymentCalendar />} />
            <Route path="services" element={<Services />} />
            <Route path="banks" element={<Banks />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
