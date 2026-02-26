import ekoLogo from "@/assets/eko-platform-services.svg";
import ekoShieldLogo from "@/assets/eko-shield-logo.png";

interface EkoLogoProps {
  variant?: "main" | "shield";
  className?: string;
  isLight?: boolean;
}

export const EkoLogo = ({ variant = "main", className = "", isLight = false }: EkoLogoProps) => {
  if (variant === "shield") {
    return (
      <img 
        src={ekoShieldLogo} 
        alt="Eko Shield Logo" 
        className={className}
      />
    );
  }

  return (
    <img 
      src={ekoLogo} 
      alt="Eko Platform Services Logo" 
      className={className}
    />
  );
};
