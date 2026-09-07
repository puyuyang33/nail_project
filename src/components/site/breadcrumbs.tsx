import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

export function Breadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-7">
      <ol className="flex flex-wrap items-center gap-2 text-[0.65rem] font-bold tracking-[0.12em] text-black/45 uppercase">
        {items.map((item, index) => (
          <li
            key={`${item.label}-${index}`}
            className="flex items-center gap-2"
          >
            {index > 0 && <ChevronRight aria-hidden="true" size={12} />}
            {item.href ? (
              <Link href={item.href} className="hover:text-wine">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
