import epsLogo from "@/assets/eps-logo-color.svg";
// import ekoShieldLogo from "@/assets/eko-shield-logo.png";

interface EkoLogoProps {
  variant?: "main" | "shield";
  className?: string;
  isLight?: boolean;
}

export const EkoLogo = ({ variant = "main", className = "", isLight = false }: EkoLogoProps) => {
  // if (variant === "shield") {
  //   return (
  //     <img
  //       src={ekoShieldLogo}
  //       alt="Eko Shield Logo"
  //       width={1400}
  //       height={1400}
  //       className={className}
  //     />
  //   );
  // }

  return (
    <img
      src={epsLogo}
      alt="Eko Platform Services Logo"
      width={232}
      height={137}
      className={className}
      style={isLight ? { filter: "brightness(0) invert(1)" } : undefined}
    />
  );
};
