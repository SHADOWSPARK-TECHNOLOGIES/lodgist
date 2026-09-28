'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { useState } from 'react';
import { auth } from '@/lib/copy';

export default function LoginPage() {
  const router = useRouter();
  const { login: loginFn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loginFn(email, password);
      toast(auth.welcomeBack, 'success');
      router.push('/listings');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : auth.loginFailed;
      toast(message || auth.loginFailed, 'error');
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
          <div>
            <label className="label">{auth.email}</label>
            <input type="email" className="input" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">{auth.password}</label>
            <input type="password" className="input" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center">
            {loading ? <span className="spinner" /> : auth.signIn}
          </button>
          <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {auth.noAccount} <Link href="/register" className="text-orange hover:underline">{auth.createOne}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
