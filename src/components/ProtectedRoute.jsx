import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({
  children,
  adminOnly = false,
  permission = null,
  permissionsAny = null,
}) {
  const { user, loading, isAdmin, canView, defaultRoute } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to={defaultRoute || '/'} replace />;
  }

  if (permission && !canView(permission)) {
    return <Navigate to={defaultRoute || '/'} replace />;
  }

  if (Array.isArray(permissionsAny) && permissionsAny.length > 0) {
    const canViewAny = permissionsAny.some((item) => canView(item));
    if (!canViewAny) {
      return <Navigate to={defaultRoute || '/'} replace />;
    }
  }

  return children;
}
