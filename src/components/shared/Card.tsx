interface CardProps {
  children: React.ReactNode;
  variant?: "default" | "hover";
  padding?: "sm" | "md" | "lg";
  className?: string;
}

const variantClasses = {
  default: "border-neutral-100",
  hover: "border-neutral-100 hover:border-primary/30 hover:bg-primary/5",
};

const paddingClasses = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Card({
  children,
  variant = "default",
  padding = "md",
  className = "",
}: CardProps) {
  return (
    <div
      className={`rounded-xl border bg-white transition-all ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
