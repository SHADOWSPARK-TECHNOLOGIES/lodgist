'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { useState } from 'react';

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
      toast('Account created successfully!', 'success');
      router.push('/listings');
    } catch (err: any) {
      toast(err.message ?? 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-poppins font-bold text-2xl text-white mb-2">Get started free</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Create your Lodgist account</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input type="text" className="input" placeholder="Chioma Okonkwo"
              value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Phone (optional)</label>
            <input type="tel" className="input" placeholder="+234 913 609 4315"
              value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" placeholder="At least 8 characters"
              value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center">
            {loading ? <span className="spinner" /> : 'Create account'}
          </button>
          <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Already have an account? <Link href="/login" className="text-orange hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
