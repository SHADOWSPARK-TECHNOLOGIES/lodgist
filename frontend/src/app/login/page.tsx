'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { auth } from '@/lib/copy';
import { safeNextPath } from '@/lib/returnPath';
import { authErrorMessage } from '@/lib/authErrors';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get('next'));
  const { login: loginFn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; signInLink: boolean } | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const errorId = 'login-error';
  const invalid = error ? true : undefined;
  const describedBy = error ? errorId : undefined;

  // Move focus to the error so keyboard and screen reader users hear it.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const registerHref = nextPath ? `/register?next=${encodeURIComponent(nextPath)}` : '/register';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loginFn(email, password);
      toast(auth.welcomeBack, 'success');
      router.push(nextPath || '/listings');
    } catch (err: unknown) {
      setError(authErrorMessage(err, 'login'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-poppins font-bold text-2xl text-white mb-2">{auth.loginTitle}</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{auth.loginSubtitle}</p>
          <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>{auth.curatorLine}</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5">
          {error && (
            <div id={errorId} ref={errorRef} tabIndex={-1} role="alert"
              className="text-sm rounded-xl px-4 py-3 border border-red-500/40 bg-red-500/10" style={{ color: '#fecaca' }}>
              {error.message}
              {error.signInLink && (
                <> <Link href={registerHref} className="underline font-semibold" style={{ color: 'var(--color-orange)' }}>{auth.signIn}</Link></>
              )}
            </div>
          )}
          <div>
            <label className="label" htmlFor="login-email">{auth.email}</label>
            <input id="login-email" name="email" type="email" aria-invalid={invalid} aria-describedby={describedBy} autoComplete="email" className="input" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="login-password">{auth.password}</label>
            <input id="login-password" name="password" type="password" aria-invalid={invalid} aria-describedby={describedBy} autoComplete="current-password" className="input" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading} aria-busy={loading} className="btn btn-primary w-full justify-center">
            {loading ? <><span className="spinner" aria-hidden="true" /><span className="sr-only">{auth.signingIn}</span></> : auth.signIn}
          </button>
          <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {auth.noAccount} <Link href={registerHref} className="text-orange hover:underline">{auth.createOne}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginForm />
    </Suspense>
  );
}
