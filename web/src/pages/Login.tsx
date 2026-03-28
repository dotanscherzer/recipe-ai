import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-warm-white flex items-center justify-center p-4">
      <div className="glass-card p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Recipe AI</h1>
          <p className="text-stone-500 mt-1">{t('auth.loginTitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-stone-700">{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-stone-700">{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <LogIn size={18} />
            {loading ? t('common.loading') : t('auth.loginTitle')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-stone-500">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-primary font-medium hover:underline">
              {t('auth.registerTitle')}
            </Link>
          </p>
        </div>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-stone-500">{t('auth.orContinueWith')}</span>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors">
              Google
            </button>
            <button className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors">
              Apple
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
