import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CustomerList from './pages/customers/CustomerList';
import CustomerForm from './pages/customers/CustomerForm';
import CustomerDetail from './pages/customers/CustomerDetail';
import ProductList from './pages/products/ProductList';
import ProductForm from './pages/products/ProductForm';
import ElevatorList from './pages/elevators/ElevatorList';
import ElevatorForm from './pages/elevators/ElevatorForm';
import ContractList from './pages/contracts/ContractList';
import ContractForm from './pages/contracts/ContractForm';
import ContractDetail from './pages/contracts/ContractDetail';
import ErrorReportList from './pages/error-reports/ErrorReportList';
import ErrorReportForm from './pages/error-reports/ErrorReportForm';
import ErrorReportDetail from './pages/error-reports/ErrorReportDetail';
import MaintenanceCalendar from './pages/maintenance-calendar/MaintenanceCalendar';
import UserList from './pages/users/UserList';
import UserForm from './pages/users/UserForm';

export default function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />

          <Route path="/customers" element={<CustomerList />} />
          <Route path="/customers/:id/detail" element={<CustomerDetail />} />
          <Route path="/customers/new" element={<ProtectedRoute adminOnly><CustomerForm /></ProtectedRoute>} />
          <Route path="/customers/:id" element={<ProtectedRoute adminOnly><CustomerForm /></ProtectedRoute>} />

          <Route path="/products" element={<ProductList />} />
          <Route path="/products/new" element={<ProtectedRoute adminOnly><ProductForm /></ProtectedRoute>} />
          <Route path="/products/:id" element={<ProtectedRoute adminOnly><ProductForm /></ProtectedRoute>} />

          <Route path="/elevators" element={<ElevatorList />} />
          <Route path="/elevators/new" element={<ProtectedRoute adminOnly><ElevatorForm /></ProtectedRoute>} />
          <Route path="/elevators/:id" element={<ProtectedRoute adminOnly><ElevatorForm /></ProtectedRoute>} />

          <Route path="/contracts" element={<ContractList />} />
          <Route path="/contracts/:id/detail" element={<ContractDetail />} />
          <Route path="/contracts/new" element={<ProtectedRoute adminOnly><ContractForm /></ProtectedRoute>} />
          <Route path="/contracts/:id" element={<ProtectedRoute adminOnly><ContractForm /></ProtectedRoute>} />

          <Route path="/error-reports" element={<ErrorReportList />} />
          <Route path="/error-reports/:id/detail" element={<ErrorReportDetail />} />
          <Route path="/error-reports/new" element={<ErrorReportForm />} />
          <Route path="/error-reports/:id" element={<ErrorReportForm />} />

          <Route path="/maintenance-calendar" element={<MaintenanceCalendar />} />

          <Route path="/users" element={<ProtectedRoute adminOnly><UserList /></ProtectedRoute>} />
          <Route path="/users/new" element={<ProtectedRoute adminOnly><UserForm /></ProtectedRoute>} />
          <Route path="/users/:id" element={<ProtectedRoute adminOnly><UserForm /></ProtectedRoute>} />
        </Route>
      </Routes>
    </>
  );
}
