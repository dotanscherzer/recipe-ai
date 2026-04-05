import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Globe, LogOut, FolderOpen } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { useCategories } from '../hooks/useCategories';
import { setLanguage } from '../i18n';

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { locale } = useAppStore();
  const { data: categories } = useCategories();

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const toggleLocale = () => {
    const newLocale = locale === 'he' ? 'en' : 'he';
    useAppStore.getState().setLocale(newLocale);
    setLanguage(newLocale);
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">{t('profile.title')}</h1>

      <div className="glass-card p-6 mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold">
            {(user?.fullName ?? '?').charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-semibold">{user?.fullName}</h2>
            <p className="text-sm text-stone-500">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="glass-card p-4 mb-4">
        <h3 className="text-sm font-semibold text-stone-600 mb-3">{t('profile.settings')}</h3>
        <button
          onClick={toggleLocale}
          className="flex items-center justify-between w-full p-3 rounded-xl hover:bg-stone-50 transition-colors"
        >
          <span className="flex items-center gap-3 text-sm">
            <Globe size={18} className="text-stone-400" />
            {t('profile.language')}
          </span>
          <span className="text-sm text-primary font-medium">
            {locale === 'he' ? 'עברית' : 'English'}
          </span>
        </button>
      </div>

      {(categories?.length ?? 0) > 0 && (
        <div className="glass-card p-4 mb-4">
          <h3 className="text-sm font-semibold text-stone-600 mb-3 flex items-center gap-2">
            <FolderOpen size={16} />
            {t('profile.categories')}
          </h3>
          <div className="space-y-2">
            {categories!.map((cat: any) => (
              <div
                key={cat.id}
                className="flex items-center gap-3 p-2 rounded-lg"
              >
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: cat.color || '#D97706' }}
                />
                <span className="text-sm">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={async () => { await logout(); navigate('/login'); }}
        className="flex items-center gap-2 w-full p-3 rounded-xl text-secondary hover:bg-secondary/10 transition-colors text-sm font-medium"
      >
        <LogOut size={18} />
        {t('nav.logout')}
      </button>
    </div>
  );
}
