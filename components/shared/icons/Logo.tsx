import Image from "next/image";

interface LogoProps {
  className?: string;
  size?: number;
}

const Logo = ({ className = "", size = 32 }: LogoProps) => (
  <Image
    src="/paynto-logo.png"
    alt="Paynto Logo"
    width={size}
    height={size}
    className={`rounded-lg ${className}`}
  />
);

export default Logo;
