'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';

const links = [
  { href: '/listings', label: 'Browse' },
  { href: '/dashboard', label: 'Dashboard', authRequired: true },
];

export function NavBar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 border-b border-white/5 backdrop-blur-md"
         style={{ background: 'rgba(11,27,43,0.85)' }}>
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-poppins font-bold text-white text-xl">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="Lodgist logo">
            <rect width="28" height="28" rx="8" fill="#FF6F3C"/>
            <path d="M7 20L14 8L21 20H7Z" fill="white" opacity="0.9"/>
            <rect x="11" y="14" width="6" height="6" rx="1" fill="#0B1B2B"/>
          </svg>
          Lodgist
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(l => (!l.authRequired || user) && (
            <Link key={l.href} href={l.href}
              className={`nav-link ${pathname === l.href ? 'text-white bg-white/5' : ''}`}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop auth */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-white/60 max-w-[120px] truncate">{user.name}</span>
              <button onClick={logout} className="btn btn-secondary btn-sm">Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="nav-link">Sign in</Link>
              <Link href="/register" className="btn btn-primary btn-sm">Get started</Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2 rounded-lg hover:bg-white/5" onClick={() => setOpen(!open)}
          aria-label="Toggle menu">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            {open
              ? <path d="M4 4L16 16M16 4L4 16" strokeLinecap="round"/>
              : <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round"/>}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/5 px-4 py-4 flex flex-col gap-2"
             style={{ background: 'rgba(11,27,43,0.97)' }}>
          {links.map(l => (!l.authRequired || user) && (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="nav-link text-base py-3">{l.label}</Link>
          ))}
          {user ? (
            <button onClick={() => { logout(); setOpen(false); }}
              className="btn btn-secondary mt-2">Sign out</button>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              <Link href="/login" onClick={() => setOpen(false)} className="btn btn-secondary">Sign in</Link>
              <Link href="/register" onClick={() => setOpen(false)} className="btn btn-primary">Get started free</Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
