import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import Header from './Header';

export default function AppLayout() {
  const { loadUser, isLoading } = useAuthStore();

  useEffect(() => { loadUser(); }, [loadUser]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-white">
      <Sidebar />
      <div className="lg:ms-64">
        <Header />
        <main className="p-4 pb-20 lg:pb-4">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
