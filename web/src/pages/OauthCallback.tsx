import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { authApi } from '../config/api';
import { useAuthStore } from '../store/authStore';

const processedExchangeCodes = new Set<string>();

export default function OauthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const error = searchParams.get('error');
    const code = searchParams.get('code');

    if (error) {
      const msg =
        error === 'access_denied' || error === 'user_cancelled_authorize'
          ? t('auth.oauthCancelled')
          : error === 'oauth_not_configured'
            ? t('auth.oauthUnavailable')
            : t('auth.oauthFailed');
      toast.error(msg);
      navigate('/login', { replace: true });
      return;
    }

    if (!code) {
      navigate('/login', { replace: true });
      return;
    }

    if (processedExchangeCodes.has(code)) {
      return;
    }
    processedExchangeCodes.add(code);

    void (async () => {
      try {
        const { accessToken, refreshToken } = await authApi.oauthExchange(code);
        authApi.setTokens(accessToken, refreshToken);
        await useAuthStore.getState().loadUser();
        navigate('/', { replace: true });
      } catch (e: unknown) {
        processedExchangeCodes.delete(code);
        const message = e instanceof Error ? e.message : t('auth.oauthFailed');
        toast.error(message);
        navigate('/login', { replace: true });
      }
    })();
  }, [searchParams, navigate, t]);

  return (
    <div className="min-h-screen bg-warm-white flex items-center justify-center p-4">
      <p className="text-stone-600">{t('common.loading')}</p>
    </div>
  );
}
