import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Search, ChefHat, Heart, User, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../lib/utils';

const navItems = [
  { to: '/', icon: Home, labelKey: 'nav.home' },
  { to: '/search', icon: Search, labelKey: 'nav.search' },
  { to: '/my-recipes', icon: ChefHat, labelKey: 'nav.myRecipes' },
  { to: '/saved', icon: Heart, labelKey: 'nav.saved' },
  { to: '/profile', icon: User, labelKey: 'nav.profile' },
];

export default function Sidebar() {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuthStore();

  return (
    <aside className="hidden lg:flex fixed inset-y-0 start-0 w-64 flex-col glass border-e border-white/20 z-40">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary">{t('app.name')}</h1>
        <p className="text-sm text-stone-500 mt-1">{t('app.tagline')}</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ to, icon: Icon, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-stone-600 hover:bg-stone-100'
              )
            }
          >
            <Icon size={20} />
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>

      {isAuthenticated && user && (
        <div className="p-4 border-t border-white/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
              {(user.fullName ?? '?').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.fullName}</p>
              <p className="text-xs text-stone-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 text-sm text-stone-500 hover:text-secondary transition-colors w-full px-2 py-1"
          >
            <LogOut size={16} />
            {t('nav.logout')}
          </button>
        </div>
      )}
    </aside>
  );
}
