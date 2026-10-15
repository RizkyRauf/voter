import type { ElectionStatus } from "@/lib/dto";

const STYLES: Record<ElectionStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-amber-100 text-amber-800" },
  OPEN: { label: "Sedang Berlangsung", className: "bg-emerald-100 text-emerald-800" },
  CLOSED: { label: "Selesai", className: "bg-slate-200 text-slate-700" },
};

export function StatusBadge({ status }: { status: ElectionStatus }) {
  const { label, className } = STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${className}`}
    >
      {label}
    </span>
  );
}
