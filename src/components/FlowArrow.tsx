interface FlowArrowProps {
  direction?: "horizontal" | "down";
}

const FlowArrow = ({ direction = "horizontal" }: FlowArrowProps) => {
  if (direction === "down") {
    return (
      <div className="flex justify-center py-2">
        <svg width="24" height="32" viewBox="0 0 24 32" className="text-primary/40">
          <defs>
            <linearGradient id="arrowGradientDown" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--secondary))" />
            </linearGradient>
          </defs>
          <path
            d="M12 0 L12 24 M6 18 L12 26 L18 18"
            fill="none"
            stroke="url(#arrowGradientDown)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4 2"
            className="animate-flow"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center px-1 flex-shrink-0">
      <svg width="40" height="24" viewBox="0 0 40 24" className="text-primary/40">
        <defs>
          <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--secondary))" />
          </linearGradient>
        </defs>
        <path
          d="M0 12 L30 12 M24 6 L32 12 L24 18"
          fill="none"
          stroke="url(#arrowGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="4 2"
          className="animate-flow"
        />
      </svg>
    </div>
  );
};

export default FlowArrow;
