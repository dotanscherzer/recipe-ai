import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Globe, LogIn } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';

export default function Header() {
  const { t } = useTranslation();
  const { isAuthenticated, user, updateUser } = useAuthStore();
  const { locale } = useAppStore();

  const toggleLocale = async () => {
    const newLocale = locale === 'he' ? 'en' : 'he';
    useAppStore.getState().setLocale(newLocale);
    if (isAuthenticated && user) {
      try {
        await updateUser({ locale: newLocale });
      } catch {
        /* keep UI locale */
      }
    }
  };

  return (
    <header className="sticky top-0 z-30 glass border-b border-white/20 px-4 h-14 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-primary lg:hidden">{t('app.name')}</h2>
      <div className="hidden lg:block" />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleLocale}
          title={locale === 'he' ? 'Switch to English' : 'עבור לעברית'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-stone-600 hover:bg-stone-100 transition-colors"
        >
          <Globe size={16} aria-hidden />
          <span className="font-medium">{locale === 'he' ? 'עברית' : 'English'}</span>
          <span className="text-xs text-stone-400 hidden sm:inline" aria-hidden>
            → {locale === 'he' ? 'English' : 'עברית'}
          </span>
        </button>

        {isAuthenticated && user ? (
          <Link
            to="/profile"
            className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm"
          >
            {(user.fullName ?? '?').charAt(0)}
          </Link>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-primary text-white hover:bg-primary-700 transition-colors"
          >
            <LogIn size={16} />
            {t('nav.login')}
          </Link>
        )}
      </div>
    </header>
  );
}
