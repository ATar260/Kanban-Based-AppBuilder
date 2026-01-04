export default function PayntoIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg 
      className={className}
      fill="none" 
      viewBox="0 0 20 20" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="20" height="20" rx="4" fill="url(#paynto-icon-gradient)" />
      <text x="10" y="14" textAnchor="middle" fill="#000" fontWeight="bold" fontSize="10">P</text>
      <defs>
        <linearGradient id="paynto-icon-gradient" x1="0" y1="0" x2="20" y2="20">
          <stop stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
    </svg>
  );
}
