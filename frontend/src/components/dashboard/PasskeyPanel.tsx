import { passkeys } from "@/lib/copy";

export default function PasskeyPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{passkeys.title}</h2>
        <p className="text-sm text-gray-500">{passkeys.subtitle}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="font-medium text-gray-900">{passkeys.passwordTitle}</p>
        <p className="text-sm text-gray-500 mt-1">{passkeys.passwordBody}</p>
      </div>
    </div>
  );
}
