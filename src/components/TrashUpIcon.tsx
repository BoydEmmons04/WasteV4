interface TrashUpIconProps {
  size?: number;
  className?: string;
}

export default function TrashUpIcon({ size = 24, className }: TrashUpIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M12 17v-7" />
      <path d="M9.5 12.5 12 10l2.5 2.5" />
    </svg>
  );
}
