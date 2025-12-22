import { LucideIcon } from "lucide-react";

interface ArchitectureCardProps {
  title: string;
  icon: LucideIcon;
  items: string[];
  index: number;
  color: "primary" | "secondary" | "mixed";
}

const ArchitectureCard = ({ title, icon: Icon, items, index, color }: ArchitectureCardProps) => {
  const colorClasses = {
    primary: "border-primary/20 hover:border-primary/40",
    secondary: "border-secondary/20 hover:border-secondary/40",
    mixed: "border-primary/20 hover:border-secondary/40",
  };

  const iconBg = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    mixed: "gradient-bg text-primary-foreground",
  };

  return (
    <div
      className={`bg-card rounded-xl p-4 card-shadow border-2 transition-all duration-300 h-full ${colorClasses[color]}`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-2 rounded-lg ${iconBg[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="font-semibold text-foreground text-xs leading-tight">{title}</h3>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <span className="w-1 h-1 rounded-full bg-primary/40 mt-1.5 flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ArchitectureCard;
