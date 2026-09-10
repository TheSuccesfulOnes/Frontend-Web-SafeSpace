export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`logo-mark${compact ? " logo-mark-compact" : ""}`}
      aria-hidden="true"
    >
      <img src="/safe-space-logo.jpeg" alt="" />
    </span>
  );
}
