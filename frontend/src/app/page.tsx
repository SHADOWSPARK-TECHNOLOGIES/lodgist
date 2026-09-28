import Link from 'next/link';
import type { Metadata } from 'next';
import { home } from '@/lib/copy';

export const metadata: Metadata = {
  title: home.metaTitle,
};

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-navy)' }}>
      <section className="section container">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border"
               style={{ background: 'rgba(26,188,156,0.08)', borderColor: 'rgba(26,188,156,0.25)' }}>
            <span className="pulse-dot" />
            <span className="text-xs font-semibold" style={{ color: 'var(--color-teal)' }}>{home.badge}</span>
          </div>

          <h1 className="font-poppins font-extrabold text-white mb-6"
              style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', lineHeight: 1.1 }}>
            {home.titleLead}<br/>
            <span style={{ color: 'var(--color-orange)' }}>{home.titleAccent}</span>
          </h1>

          <p className="text-lg mb-10 mx-auto" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '52ch' }}>
            {home.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/listings" className="btn btn-primary btn-lg">{home.browseCta}</Link>
            <Link href="/register" className="btn btn-secondary btn-lg">{home.listCta}</Link>
          </div>
        </div>
      </section>

      <section className="container pb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {home.stats.map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-value">{s.value}</div>
              <div style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600, color: '#fff', fontSize: '0.875rem', marginTop: '0.25rem' }}>{s.label}</div>
              <div className="stat-label">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="text-center mb-12">
          <h2 className="font-poppins font-bold text-white mb-3"
              style={{ fontSize: 'clamp(1.125rem, 1rem + 0.75vw, 1.5rem)' }}>
            {home.whyTitle}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '48ch', margin: '0 auto' }}>{home.whySub}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {home.features.map(f => (
            <div key={f.title} className="card card-elevated">
              <div style={{ fontSize: '2.25rem', marginBottom: '0.75rem' }}>{f.icon}</div>
              <h3 className="font-poppins font-semibold text-white mb-2" style={{ fontSize: '1.125rem' }}>{f.title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem', lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section container">
        <h2 className="font-poppins font-bold text-white text-center mb-2"
            style={{ fontSize: 'clamp(1.125rem, 1rem + 0.75vw, 1.5rem)' }}>{home.storiesTitle}</h2>
        <p className="text-center mb-10 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{home.storiesNote}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {home.examples.map(t => (
            <div key={t.city} className="card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-poppins font-bold text-sm"
                     style={{ background: 'rgba(255,111,60,0.15)', color: 'var(--color-orange)' }}>E</div>
                <div>
                  <div className="font-semibold text-sm text-white">{t.name}</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{t.city}</div>
                </div>
                <div className="ml-auto"><span className="badge badge-teal">{t.score}</span></div>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.875rem', lineHeight: 1.7 }}>{t.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="text-center rounded-3xl p-12 border"
             style={{ background: 'linear-gradient(135deg, rgba(255,111,60,0.12), rgba(26,188,156,0.10))', borderColor: 'rgba(255,255,255,0.08)' }}>
          <h2 className="font-poppins font-extrabold text-white mb-4"
              style={{ fontSize: 'clamp(1.125rem, 1rem + 0.75vw, 1.5rem)' }}>{home.closeTitle}</h2>
          <p className="mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>{home.closeSub}</p>
          <Link href="/register" className="btn btn-primary btn-lg">{home.closeCta}</Link>
        </div>
      </section>

      <footer className="border-t py-8" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-poppins font-bold text-white">Lodgist</span>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem' }}>{home.footer}</span>
          <div className="flex gap-6">
            {[['Browse', '/listings'], ['Sign in', '/login'], ['Register', '/register']].map(([l, h]) => (
              <Link key={h} href={h} className="nav-link" style={{ fontSize: '0.75rem' }}>{l}</Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
