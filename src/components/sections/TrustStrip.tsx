import { CheckCircle } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A trust badge: either a plain label (rendered with `defaultIcon`) or an
 * object carrying its own icon node.
 */
export type TrustBadge = string | { label: string; icon?: ReactNode };

interface TrustStripProps {
  items: TrustBadge[];
  /** Container classes. */
  className?: string;
  /** Per-item wrapper classes. */
  itemClassName?: string;
  /** Icon used when an item doesn't supply its own. */
  defaultIcon?: ReactNode;
}

/**
 * Inline row of trust badges (e.g. "RBI compliant", "Reliable, high-volume
 * workflows"). Shared by the industry/solution page heroes (plain string
 * labels with the default CheckCircle) and the home hero (per-item custom SVG
 * icons via the object form).
 */
export const TrustStrip = ({
  items,
  className = "flex flex-wrap gap-4 mb-8",
  itemClassName = "inline-flex items-center gap-1.5 text-sm text-white/70",
  defaultIcon = <CheckCircle className="w-4 h-4 text-eko-gold shrink-0" />,
}: TrustStripProps) => {
  return (
    <div className={className}>
      {items.map((item) => {
        const label = typeof item === "string" ? item : item.label;
        const icon = typeof item === "string" ? undefined : item.icon;
        return (
          <span key={label} className={itemClassName}>
            {icon ?? defaultIcon}
            {label}
          </span>
        );
      })}
    </div>
  );
};
