import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number | string;
  description?: string;
  icon?: React.ReactNode;
  trend?: { value: string; positive: boolean };
  className?: string;
}

export function StatCard({ title, value, description, icon, trend, className }: StatCardProps) {
  return (
    <div className={cn("bg-white rounded-xl border border-neutral-100 p-5", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-neutral-500">{title}</p>
          <p className="text-2xl font-bold text-neutral-900">{value}</p>
          {description && <p className="text-xs text-neutral-400">{description}</p>}
          {trend && (
            <p className={cn("text-xs", trend.positive ? "text-green-600" : "text-danger")}>
              {trend.value}
            </p>
          )}
        </div>
        {icon && <div className="text-neutral-300">{icon}</div>}
      </div>
    </div>
  );
}
