'use client';

import { auth } from '@/lib/copy';

/**
 * Show/hide password. The accessible name stays "Show password" and
 * aria-pressed carries the state, so screen readers announce "pressed" when
 * the password is visible.
 */
export function PasswordToggle({ shown, controls, onToggle }: { shown: boolean; controls: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      aria-pressed={shown}
      aria-controls={controls}
      aria-label={auth.showPassword}
      onClick={onToggle}
      style={{ minWidth: 44, minHeight: 44 }}
    >
      {shown ? auth.hide : auth.show}
    </button>
  );
}
