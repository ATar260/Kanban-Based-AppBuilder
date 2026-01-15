import Image from "next/image";

interface PayntoIconProps {
  className?: string;
  size?: number;
}

export default function PayntoIcon({
  className = "",
  size = 24
}: PayntoIconProps) {
  return (
    <Image
      src="/paynto-logo.png"
      alt="Paynto Icon"
      width={size}
      height={size}
      className={`rounded-md ${className}`}
    />
  );
}
