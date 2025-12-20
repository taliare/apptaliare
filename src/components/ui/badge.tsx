import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
    "transition-all duration-300 ease-out",
    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "border-transparent bg-primary text-primary-foreground",
          "shadow-[0_0_12px_hsl(var(--primary)/0.4)]",
          "hover:shadow-[0_0_20px_hsl(var(--primary)/0.6)]",
          "hover:scale-105",
        ].join(" "),
        secondary: [
          "border-transparent bg-secondary text-secondary-foreground",
          "hover:bg-secondary/80 hover:scale-105",
        ].join(" "),
        destructive: [
          "border-transparent bg-destructive/15 text-destructive border border-destructive/30",
          "hover:bg-destructive/25 hover:scale-105",
        ].join(" "),
        outline: [
          "text-foreground border-border",
          "hover:bg-secondary hover:scale-105",
        ].join(" "),
        success: [
          "border-transparent bg-success/15 text-success border border-success/30",
          "hover:bg-success/25 hover:scale-105",
        ].join(" "),
        warning: [
          "border-transparent bg-warning/15 text-warning border border-warning/30",
          "hover:bg-warning/25 hover:scale-105",
        ].join(" "),
        info: [
          "border-transparent bg-info/15 text-info border border-info/30",
          "hover:bg-info/25 hover:scale-105",
        ].join(" "),
        glow: [
          "border-transparent bg-primary text-primary-foreground",
          "shadow-[0_0_15px_hsl(var(--primary)/0.5)]",
          "animate-pulse-subtle",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
