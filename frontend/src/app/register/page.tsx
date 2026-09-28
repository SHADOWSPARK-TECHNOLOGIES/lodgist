'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { useState } from 'react';
import { auth } from '@/lib/copy';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password, name, phone || undefined);
      toast(auth.registrationSuccess, 'success');
      router.push('/listings');
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
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">{auth.fullName}</label>
            <input type="text" className="input" placeholder="Chioma Okonkwo"
              value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">{auth.email}</label>
            <input type="email" className="input" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">{auth.phoneOptional}</label>
            <input type="tel" className="input" placeholder="080..."
              value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="label">{auth.password}</label>
            <input type="password" className="input" placeholder="At least 8 characters"
              value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center">
            {loading ? <span className="spinner" /> : auth.createAccount}
          </button>
          <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {auth.alreadyHaveAccount} <Link href="/login" className="text-orange hover:underline">{auth.signIn}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
