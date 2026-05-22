type ShapeMarkProps = {
  size?: number;
  className?: string;
};

export function ShapeMark({ size = 24, className }: ShapeMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" />
      <circle cx="18" cy="6" r="2" fill="var(--highlight)" />
    </svg>
  );
}
