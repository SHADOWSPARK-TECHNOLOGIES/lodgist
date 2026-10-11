'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { auth } from '@/lib/copy';
import { safeNextPath } from '@/lib/returnPath';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get('next'));
  const { register } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password, name, phone || undefined);
      toast(auth.registrationSuccess, 'success');
      router.push(nextPath || '/listings');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : auth.registrationFailure;
      toast(message || auth.registrationFailure, 'error');
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

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="register-name">{auth.fullName}</label>
            <input id="register-name" name="name" type="text" autoComplete="name" className="input" placeholder={auth.namePlaceholder}
              value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="register-email">{auth.email}</label>
            <input id="register-email" name="email" type="email" autoComplete="email" className="input" placeholder={auth.emailPlaceholder}
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="register-phone">{auth.phoneOptional}</label>
            <input id="register-phone" name="phone" type="tel" autoComplete="tel" className="input" placeholder={auth.phonePlaceholder}
              value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="register-password">{auth.password}</label>
            <input id="register-password" name="password" type="password" autoComplete="new-password" className="input" placeholder={auth.passwordPlaceholder}
              value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
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

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <RegisterForm />
    </Suspense>
  );
}
