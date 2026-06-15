import epsLogo from "@/assets/eps-logo-color.svg";

interface EkoLogoProps {
	className?: string;
	isLight?: boolean;
}

export const EkoLogo = ({ className = "", isLight = false }: EkoLogoProps) => {
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
