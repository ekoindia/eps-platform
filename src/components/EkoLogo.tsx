import ekoLogo from "@/assets/eko-logo.svg";
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
      alt="Eko Logo" 
      className={`${className} ${isLight ? "brightness-0 invert" : ""}`}
    />
  );
};
