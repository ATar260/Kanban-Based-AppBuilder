import Image from "next/image";

interface PayntoLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export default function PayntoLogo({
  className = "",
  size = 32,
  showText = true
}: PayntoLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/paynto-logo.png"
        alt="Paynto Logo"
        width={size}
        height={size}
        className="rounded-lg"
      />
      {showText && (
        <span className="text-lg font-medium text-foreground tracking-tight">
          Paynto
        </span>
      )}
    </div>
  );
}
