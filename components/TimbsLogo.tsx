export default function TimbsLogo() {
  return (
    <svg
      fill="none"
      height="24"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="6" fill="url(#timbs-gradient)" />
      <text x="12" y="16" textAnchor="middle" fill="#000" fontWeight="bold" fontSize="12">T</text>
      <defs>
        <linearGradient id="timbs-gradient" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
    </svg>
  );
}
