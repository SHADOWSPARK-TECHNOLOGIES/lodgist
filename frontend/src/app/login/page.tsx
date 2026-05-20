'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { useState } from 'react';

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
      toast('Welcome back!', 'success');
      router.push('/listings');
    } catch (err: any) {
      toast(err.message ?? 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-poppins font-bold text-2xl text-white mb-2">Welcome back</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Sign in to your Lodgist account</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5">
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center">
            {loading ? <span className="spinner" /> : 'Sign in'}
          </button>
          <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            No account? <Link href="/register" className="text-orange hover:underline">Create one</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
