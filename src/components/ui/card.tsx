import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "glass" | "gradient" | "glow" | "interactive";
  }
>(({ className, variant = "default", ...props }, ref) => {
  const variants = {
    default: [
      "bg-card border border-border shadow-soft",
      "transition-all duration-300 ease-out",
    ].join(" "),
    glass: [
      "bg-card/50 backdrop-blur-xl border border-border/50",
      "transition-all duration-300 ease-out",
      "hover:bg-card/60 hover:border-border/70",
    ].join(" "),
    gradient: [
      "bg-gradient-to-br from-card via-card to-background border border-border",
      "transition-all duration-300 ease-out",
    ].join(" "),
    glow: [
      "bg-card border border-primary/20",
      "shadow-[0_0_20px_hsl(var(--primary)/0.15)]",
      "transition-all duration-300 ease-out",
      "hover:shadow-[0_0_30px_hsl(var(--primary)/0.25)]",
      "hover:border-primary/30",
    ].join(" "),
    interactive: [
      "bg-card border border-border shadow-soft",
      "transition-all duration-300 ease-out",
      "hover:-translate-y-1 hover:shadow-soft-lg",
      "hover:border-primary/30",
      "cursor-pointer",
      "group",
    ].join(" "),
  };

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl text-card-foreground",
        variants[variant],
        className
      )}
      {...props}
    />
  );
});
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-4 xs:p-5 sm:p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-display text-base xs:text-lg sm:text-xl font-semibold leading-tight tracking-tight",
      "transition-colors duration-300",
      "group-hover:text-primary",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs xs:text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 xs:p-5 sm:p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-4 xs:p-5 sm:p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
