import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Find Verified Property in Nigeria — No Fraud, No Middlemen',
};

const stats = [
  { value: '0%',   label: 'Fraud Rate',        sub: 'AI-verified listings' },
  { value: '₦0',   label: 'Hidden Fees',        sub: 'Total transparency' },
  { value: '100%', label: 'Verified',           sub: 'Landlord ID checked' },
  { value: '24/7', label: 'Support',            sub: 'WhatsApp + in-app' },
];

const features = [
  { icon: '🛡️', title: 'Truth Index Score', desc: 'Every landlord and listing is scored by our AI fraud engine. Real tenant reviews. No fake profiles.' },
  { icon: '💰', title: 'Rent Escrow', desc: 'Pay securely into escrow. Funds released only when you inspect and confirm the property. Your money is always protected.' },
  { icon: '📱', title: 'WhatsApp Native', desc: 'Browse listings, verify landlords, and schedule viewings — all without leaving WhatsApp. Built for how Nigerians actually use the internet.' },
  { icon: '🔑', title: 'Passkey Security', desc: 'Sign in with fingerprint or Face ID. No passwords to steal. No SIM-swap fraud. FIDO2 standard — same tech as your bank.' },
];

const testimonials = [
  { name: 'Chioma A.',   city: 'Owerri',        score: 94, text: 'Found my flat in 3 days. The landlord was truth-index verified. Moved in with zero drama.' },
  { name: 'Emeka N.',    city: 'Port Harcourt',  score: 88, text: 'Rent escrow gave me peace of mind. The agent I dealt with before Lodgist ran away with my deposit.' },
  { name: 'Adaeze O.',   city: 'Lagos',          score: 97, text: 'Listed my property and got 12 verified tenant enquiries in a week. All serious people.' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-navy)' }}>

      {/* HERO */}
      <section className="section container">
        <div className="max-w-4xl mx-auto text-center">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border"
               style={{ background: 'rgba(26,188,156,0.08)', borderColor: 'rgba(26,188,156,0.25)' }}>
            <span className="pulse-dot" />
            <span className="text-xs font-semibold" style={{ color: 'var(--color-teal)' }}>Now live — Imo State & Port Harcourt</span>
          </div>

          <h1 className="font-poppins font-extrabold text-white mb-6"
              style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', lineHeight: 1.1 }}>
            Find Property in Nigeria<br/>
            <span style={{ color: 'var(--color-orange)' }}>Without the Fraud</span>
          </h1>

          <p className="text-lg mb-10 mx-auto" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '52ch' }}>
            Every listing verified. Every landlord truth-index scored.
            Rent escrow protects your money. No agents. No wahala.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/listings" className="btn btn-primary btn-lg">
              Browse Verified Listings →
            </Link>
            <Link href="/register" className="btn btn-secondary btn-lg">
              List Your Property Free
            </Link>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="container pb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-value">{s.value}</div>
              <div style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600, color: '#fff', fontSize: '0.875rem', marginTop: '0.25rem' }}>{s.label}</div>
              <div className="stat-label">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="section container">
        <div className="text-center mb-12">
          <h2 className="font-poppins font-bold text-white mb-3"
              style={{ fontSize: 'clamp(1.125rem, 1rem + 0.75vw, 1.5rem)' }}>
            Why Nigerians choose Lodgist
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '48ch', margin: '0 auto' }}>
            Built specifically for the Nigerian property market — where trust is the hardest thing to earn.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map(f => (
            <div key={f.title} className="card card-elevated">
              <div style={{ fontSize: '2.25rem', marginBottom: '0.75rem' }}>{f.icon}</div>
              <h3 className="font-poppins font-semibold text-white mb-2"
                  style={{ fontSize: '1.125rem' }}>{f.title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem', lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section container">
        <h2 className="font-poppins font-bold text-white text-center mb-10"
            style={{ fontSize: 'clamp(1.125rem, 1rem + 0.75vw, 1.5rem)' }}>Real stories from real tenants</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map(t => (
            <div key={t.name} className="card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-poppins font-bold text-sm"
                     style={{ background: 'rgba(255,111,60,0.15)', color: 'var(--color-orange)' }}>
                  {t.name[0]}
                </div>
                <div>
                  <div className="font-semibold text-sm text-white">{t.name}</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{t.city}</div>
                </div>
                <div className="ml-auto">
                  <span className="badge badge-teal">{t.score} Trust</span>
                </div>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.875rem', lineHeight: 1.7 }}>
                &ldquo;{t.text}&rdquo;
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section container">
        <div className="text-center rounded-3xl p-12 border"
             style={{ background: 'linear-gradient(135deg, rgba(255,111,60,0.12), rgba(26,188,156,0.10))', borderColor: 'rgba(255,255,255,0.08)' }}>
          <h2 className="font-poppins font-extrabold text-white mb-4"
              style={{ fontSize: 'clamp(1.125rem, 1rem + 0.75vw, 1.5rem)' }}>
            Ready to rent smarter?
          </h2>
          <p className="mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Join thousands of Nigerians finding verified homes without the stress.
          </p>
          <Link href="/register" className="btn btn-primary btn-lg">
            Create Free Account →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t py-8" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-poppins font-bold text-white">Lodgist</span>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem' }}>
            © 2026 ShadowSpark Technologies · Port Harcourt, Nigeria
          </span>
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
