import Image from "next/image";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export default function Logo({ className = "", showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/paynto-logo.png"
        alt="Paynto Logo"
        width={28}
        height={28}
        className="rounded-lg"
      />
      {showText && (
        <span className="text-base font-medium text-foreground tracking-tight">
          Paynto
        </span>
      )}
    </div>
  );
}
