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
import ProductDetail from './pages/products/ProductDetail';
import ElevatorList from './pages/elevators/ElevatorList';
import ElevatorForm from './pages/elevators/ElevatorForm';
import ElevatorDetail from './pages/elevators/ElevatorDetail';
import ContractList from './pages/contracts/ContractList';
import ContractForm from './pages/contracts/ContractForm';
import ContractDetail from './pages/contracts/ContractDetail';
import ErrorReportList from './pages/error-reports/ErrorReportList';
import ErrorReportForm from './pages/error-reports/ErrorReportForm';
import ErrorReportDetail from './pages/error-reports/ErrorReportDetail';
import MaintenanceCalendar from './pages/maintenance-calendar/MaintenanceCalendar';
import MaintenanceOrderList from './pages/maintenance-orders/MaintenanceOrderList';
import MaintenanceOrderDetail from './pages/maintenance-orders/MaintenanceOrderDetail';
import UserList from './pages/users/UserList';
import UserForm from './pages/users/UserForm';
import NotificationList from './pages/notifications/NotificationList';

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
          <Route path="/" element={<ProtectedRoute permission="dashboard"><Dashboard /></ProtectedRoute>} />

          <Route path="/customers" element={<ProtectedRoute permission="customers"><CustomerList /></ProtectedRoute>} />
          <Route path="/customers/:id/detail" element={<ProtectedRoute permission="customers"><CustomerDetail /></ProtectedRoute>} />
          <Route path="/customers/new" element={<ProtectedRoute adminOnly><CustomerForm /></ProtectedRoute>} />
          <Route path="/customers/:id" element={<ProtectedRoute adminOnly><CustomerForm /></ProtectedRoute>} />

          <Route path="/products" element={<ProtectedRoute permission="products"><ProductList /></ProtectedRoute>} />
          <Route path="/products/:id/detail" element={<ProtectedRoute permission="products"><ProductDetail /></ProtectedRoute>} />
          <Route path="/products/new" element={<ProtectedRoute adminOnly><ProductForm /></ProtectedRoute>} />
          <Route path="/products/:id" element={<ProtectedRoute adminOnly><ProductForm /></ProtectedRoute>} />

          <Route path="/elevators" element={<ProtectedRoute permission="elevators"><ElevatorList /></ProtectedRoute>} />
          <Route path="/elevators/:id/detail" element={<ProtectedRoute permission="elevators"><ElevatorDetail /></ProtectedRoute>} />
          <Route path="/elevators/new" element={<ProtectedRoute adminOnly><ElevatorForm /></ProtectedRoute>} />
          <Route path="/elevators/:id" element={<ProtectedRoute adminOnly><ElevatorForm /></ProtectedRoute>} />

          <Route path="/contracts" element={<ProtectedRoute permission="contracts"><ContractList /></ProtectedRoute>} />
          <Route path="/contracts/:id/detail" element={<ProtectedRoute permission="contracts"><ContractDetail /></ProtectedRoute>} />
          <Route path="/contracts/new" element={<ProtectedRoute adminOnly><ContractForm /></ProtectedRoute>} />
          <Route path="/contracts/:id" element={<ProtectedRoute adminOnly><ContractForm /></ProtectedRoute>} />

          <Route path="/error-reports" element={<ProtectedRoute permission="errorReports"><ErrorReportList /></ProtectedRoute>} />
          <Route path="/error-reports/:id/detail" element={<ProtectedRoute permission="errorReports"><ErrorReportDetail /></ProtectedRoute>} />
          <Route path="/error-reports/new" element={<ProtectedRoute permission="errorReports"><ErrorReportForm /></ProtectedRoute>} />
          <Route path="/error-reports/:id" element={<ProtectedRoute permission="errorReports"><ErrorReportForm /></ProtectedRoute>} />

          <Route path="/maintenance-calendar" element={<ProtectedRoute permission="maintenanceCalendar"><MaintenanceCalendar /></ProtectedRoute>} />
          <Route path="/maintenance-orders" element={<ProtectedRoute adminOnly permission="maintenanceOrders"><MaintenanceOrderList /></ProtectedRoute>} />
          <Route path="/my-jobs" element={<ProtectedRoute permission="myJobs"><MaintenanceOrderList mineOnly /></ProtectedRoute>} />
          <Route path="/maintenance-orders/schedule/:scheduleId/detail" element={<ProtectedRoute permissionsAny={['maintenanceOrders', 'myJobs']}><MaintenanceOrderDetail /></ProtectedRoute>} />
          <Route path="/maintenance-orders/:id/detail" element={<ProtectedRoute permissionsAny={['maintenanceOrders', 'myJobs']}><MaintenanceOrderDetail /></ProtectedRoute>} />

          <Route path="/notifications" element={<ProtectedRoute permission="notifications"><NotificationList /></ProtectedRoute>} />

          <Route path="/users" element={<ProtectedRoute adminOnly permission="users"><UserList /></ProtectedRoute>} />
          <Route path="/users/new" element={<ProtectedRoute adminOnly permission="users"><UserForm /></ProtectedRoute>} />
          <Route path="/users/:id" element={<ProtectedRoute adminOnly permission="users"><UserForm /></ProtectedRoute>} />
        </Route>
      </Routes>
    </>
  );
}
