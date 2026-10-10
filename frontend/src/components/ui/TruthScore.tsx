import { jargon } from '@/lib/copy';

interface TruthScoreProps { score: number; size?: 'sm' | 'md'; }

export function TruthScore({ score, size = 'md' }: TruthScoreProps) {
  const color = score >= 80 ? 'var(--color-teal)' : score >= 60 ? 'var(--color-orange)' : '#ef4444';
  const label = score >= 90 ? jargon.strong : score >= 75 ? jargon.solid : score >= 60 ? jargon.average : jargon.weak;
  const isSmall = size === 'sm';

  return (
    <div className="inline-flex items-center gap-1.5"
         title={`${jargon.trustScore}: ${score}/100. ${jargon.trustHint}`}>
      <div style={{
        width: isSmall ? 32 : 44,
        height: isSmall ? 32 : 44,
        borderRadius: '50%',
        background: `conic-gradient(${color} ${score}%, rgba(255,255,255,0.07) 0%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          width: isSmall ? 24 : 34, height: isSmall ? 24 : 34,
          borderRadius: '50%', background: 'var(--color-navy-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <span style={{ fontSize: isSmall ? '0.55rem' : '0.65rem', fontWeight: 700, color, fontFamily: 'var(--font-poppins)' }}>
            {score}
          </span>
        </div>
      </div>
      {!isSmall && (
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color, fontFamily: 'var(--font-poppins)' }}>{label}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-faint)' }}>{jargon.trustScore}</div>
        </div>
      )}
    </div>
  );
}
