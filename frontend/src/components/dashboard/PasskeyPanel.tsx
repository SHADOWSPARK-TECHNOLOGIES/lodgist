"use client";

import { passkeys } from "@/lib/copy";

export default function PasskeyPanel() {
  return (
    <div className="space-y-3 bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900">{passkeys.title}</h2>
      <p className="text-sm text-gray-600">{passkeys.subtitle}</p>
      <p className="text-sm text-gray-500">{passkeys.off}</p>
    </div>
  );
}
