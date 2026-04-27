/**
 * Breadcrumb trail for non-run dashboard pages.
 * Renders BEAGLELABS › <PAGE> in uppercase 10px tracking-wider muted text.
 * Per CONTEXT.md <decisions> Track 1: thin row below header. Run page does
 * NOT use this component — its existing title row plays the same role.
 */
interface BreadcrumbProps {
  trail: string[];
}

export function Breadcrumb({ trail }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="border-b border-white/5 bg-bg px-4 py-2 md:px-6"
    >
      <ol className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {trail.map((item, i) => (
          <li key={`${i}-${item}`} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">›</span>}
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
