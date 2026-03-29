'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/hooks/use-i18n';
import { Lock } from 'lucide-react';

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
        return;
      }

      if (res.status === 429) {
        const data = await res.json();
        const seconds = data.retryAfterSeconds ?? 60;
        setError(t('auth.tooManyAttempts').replace('{seconds}', String(seconds)));
      } else {
        setError(t('auth.wrongPassword'));
      }
    } catch {
      setError(t('auth.wrongPassword'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Lock className="w-7 h-7 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-xl font-bold text-center text-gray-800 dark:text-gray-100 mb-1">
            OpenMAIC
          </h1>
          <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">
            {t('auth.loginTitle')}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                autoFocus
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all text-sm"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 dark:text-red-400 text-center px-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium text-sm hover:from-violet-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/25"
            >
              {loading ? t('common.loading') : t('auth.submit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
