'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { auth } from '@/lib/copy';
import { PasswordToggle } from '@/components/ui/PasswordToggle';
import { authErrorMessage } from '@/lib/authErrors';

export default function RegisterForm({ nextPath }: { nextPath: string | null }) {
  const router = useRouter();
  const { register } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<{ message: string; signInLink: boolean } | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const errorId = 'register-error';
  const invalid = error ? true : undefined;
  const describedBy = error ? errorId : undefined;
  const passwordDescribedBy = [
    'register-password-hint',
    error ? errorId : null,
  ].filter(Boolean).join(' ');

  // Move focus to the error so keyboard and screen reader users hear it.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register(email, password, name, phone || undefined);
      toast(auth.registrationSuccess, 'success');
      router.push(nextPath || '/listings');
    } catch (err: unknown) {
      setError(authErrorMessage(err, 'register'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-poppins font-bold text-2xl text-white mb-2">{auth.getStarted}</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{auth.createAccountSubtitle}</p>
          <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>{auth.curatorLine}</p>
        </div>

        <form method="post" onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div id={errorId} ref={errorRef} tabIndex={-1} role="alert"
              className="text-sm rounded-xl px-4 py-3 border border-red-500/40 bg-red-500/10" style={{ color: '#fecaca' }}>
              {error.message}
              {error.signInLink && (
                <> <Link href={loginHref} className="underline font-semibold" style={{ color: 'var(--color-orange)' }}>{auth.signIn}</Link></>
              )}
            </div>
          )}
          <div>
            <label className="label" htmlFor="register-name">{auth.fullName}</label>
            <input id="register-name" name="name" type="text" aria-invalid={invalid} aria-describedby={describedBy} autoComplete="name" className="input" placeholder={auth.namePlaceholder}
              value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="register-email">{auth.email}</label>
            <input id="register-email" name="email" type="email" aria-invalid={invalid} aria-describedby={describedBy} autoComplete="email" className="input" placeholder={auth.emailPlaceholder}
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="register-phone">{auth.phoneOptional}</label>
            <input id="register-phone" name="phone" type="tel" aria-invalid={invalid} aria-describedby={describedBy} autoComplete="tel" className="input" placeholder={auth.phonePlaceholder}
              value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="register-password">{auth.password}</label>
            <div className="flex gap-2 items-stretch">
              <input id="register-password" name="password" type={showPassword ? 'text' : 'password'} aria-invalid={invalid} aria-describedby={passwordDescribedBy} autoComplete="new-password" className="input flex-1" placeholder={auth.passwordPlaceholder}
              value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
              <PasswordToggle shown={showPassword} controls="register-password" onToggle={() => setShowPassword(v => !v)} />
            </div>
            <p id="register-password-hint" className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>{auth.passwordRule}</p>
          </div>
          <button type="submit" disabled={loading} aria-busy={loading} className="btn btn-primary w-full justify-center">
            {loading ? <><span className="spinner" aria-hidden="true" /><span className="sr-only">{auth.creatingAccount}</span></> : auth.createAccount}
          </button>
          <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {auth.alreadyHaveAccount} <Link href={loginHref} className="text-orange hover:underline">{auth.signIn}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
