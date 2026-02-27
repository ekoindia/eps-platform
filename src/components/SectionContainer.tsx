import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionContainerProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "navy" | "muted";
  id?: string;
}

export const SectionContainer = ({
  children,
  className,
  variant = "default",
  id
}: SectionContainerProps) => {
  const variants = {
    default: "bg-background",
    navy: "hero-gradient hero-pattern text-white",
    muted: "bg-muted"
  };

  return (
    <section id={id} className={cn("py-20 lg:py-28", variants[variant], className)}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </section>);

};

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  centered?: boolean;
  light?: boolean;
  className?: string;
}

export const SectionHeader = ({
  title,
  subtitle,
  badge,
  centered = true,
  light = false,
  className
}: SectionHeaderProps) => {
  return (
    <div className={cn(centered && "text-center", className)}>
      {badge






      }
      <h2 className={cn(
        "text-3xl md:text-4xl lg:text-5xl font-bold mb-4",
        light ? "text-white" : "text-foreground"
      )}>
        {title}
      </h2>
      {subtitle &&
      <p className={cn(
        "text-lg max-w-3xl leading-relaxed",
        centered && "mx-auto",
        light ? "text-white/80" : "text-muted-foreground"
      )}>
          {subtitle}
        </p>
      }
    </div>);

};