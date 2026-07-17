import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
	const { theme = "system" } = useTheme();

	return (
		<Sonner
			theme={theme as ToasterProps["theme"]}
			// Bottom-left: the bottom-right corner is occupied by the Zoho
			// SalesIQ chat widget. Overridable via props.
			position="bottom-left"
			className="toaster group"
			closeButton
			toastOptions={{
				classNames: {
					closeButton:
						"group-[.toast]:bg-background group-[.toast]:text-foreground group-[.toast]:border-border group-[.toast]:hover:bg-muted",
					toast:
						"group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
					description: "group-[.toast]:text-muted-foreground",
					actionButton:
						"group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
					cancelButton:
						"group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
				},
			}}
			{...props}
		/>
	);
};

export { Toaster, toast };
