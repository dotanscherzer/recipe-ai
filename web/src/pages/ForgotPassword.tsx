import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { authApi } from '../config/api';
import { toast } from 'sonner';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
      setSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('common.error');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-warm-white flex items-center justify-center p-4">
      <div className="glass-card p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Recipe AI</h1>
          <p className="text-stone-500 mt-1">{t('auth.forgotPasswordTitle')}</p>
        </div>

        <p className="text-sm text-stone-600 mb-4 leading-relaxed">{t('auth.forgotPasswordHint')}</p>

        {sent ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-stone-600 leading-relaxed">{t('auth.forgotPasswordCheckInbox')}</p>
            <Link
              to="/login"
              className="inline-block text-primary font-medium hover:underline"
            >
              {t('auth.backToLogin')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-stone-700">{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-1 w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <KeyRound size={18} />
              {loading ? t('common.loading') : t('auth.sendResetLink')}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm text-primary font-medium hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}
