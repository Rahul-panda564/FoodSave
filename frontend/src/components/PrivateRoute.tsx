import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { state } = useAuth();
  const location = useLocation();

  if (!state.isAuthenticated && !state.isLoading) {
    // Redirect unauthenticated users to home page
    return <Navigate to="/home" state={{ from: location }} replace />;
  }

  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          <p className="mt-4 text-xs sm:text-sm font-semibold text-slate-500">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default PrivateRoute;
