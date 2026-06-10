import { Button } from "@/components/ui/button";
import { MenuItemLink, DropdownColumnHeader } from "@/components/DropdownGrid";
import { openZohoChat } from "@/lib/zoho-chat";

interface NavApiItem {
	label: string;
	href: string;
	shortDesc: string;
	icon: React.ComponentType<{ className?: string }>;
}

interface ProductsMegaPanelProps {
	verificationApis: NavApiItem[];
	paymentApis: NavApiItem[];
	bcApis: NavApiItem[];
	onItemClick: () => void;
}

/**
 * Desktop Products mega-menu panel.
 * Verification APIs flow across 2 (lg) / 3 (xl) compact sub-columns under a
 * single header; Payment & BC APIs stack in a separated fourth column with a
 * "Get Started" CTA card below them.
 */
export const ProductsMegaPanel = ({
	verificationApis,
	paymentApis,
	bcApis,
	onItemClick,
}: ProductsMegaPanelProps) => (
	<div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex justify-center gap-6 xl:gap-10">
		{/* Verification APIs — one header, items flow into sub-columns */}
		<div className="min-w-0">
			<DropdownColumnHeader
				title="Verification APIs"
				link={{ label: "See all →", to: "/products", onClick: onItemClick }}
			/>
			<div className="grid grid-flow-col grid-rows-10 xl:grid-rows-7 gap-x-2 gap-y-1.5">
				{verificationApis.map((item, index) => (
					<MenuItemLink
						key={item.href}
						compact
						to={item.href}
						icon={item.icon}
						label={item.label}
						description={item.shortDesc}
						index={index}
						onClick={onItemClick}
					/>
				))}
			</div>
		</div>

		{/* Fourth column — Payment + BC sections + CTA card */}
		<div className="w-[300px] xl:w-[330px] shrink-0 border-l border-eko-navy/10 pl-6 xl:pl-8">
			<DropdownColumnHeader title="Payment APIs" />
			<div className="flex flex-col gap-0.5">
				{paymentApis.map((item, index) => (
					<MenuItemLink
						key={item.href}
						to={item.href}
						icon={item.icon}
						label={item.label}
						description={item.shortDesc}
						index={index + 4}
						onClick={onItemClick}
					/>
				))}
			</div>

			<div className="mt-5">
				<DropdownColumnHeader title="BC APIs" />
				<div className="flex flex-col gap-0.5">
					{bcApis.map((item, index) => (
						<MenuItemLink
							key={item.href}
							to={item.href}
							icon={item.icon}
							label={item.label}
							description={item.shortDesc}
							index={index + 6}
							onClick={onItemClick}
						/>
					))}
				</div>
			</div>

			{/* CTA card */}
			<div
				className="mt-6 rounded-xl bg-linear-to-br from-[#00394b] to-[#005a6e] p-4 animate-fade-up [animation-duration:300ms]"
				style={{ animationDelay: "240ms", animationFillMode: "backwards" }}
			>
				<p className="text-sm font-bold text-white">Ready to integrate?</p>
				<p className="text-xs text-white/70 mt-0.5">Go live with Eko APIs in days, not months.</p>
				<Button
					variant="gold"
					size="sm"
					className="mt-3 w-full cursor-pointer"
					onClick={() => {
						onItemClick();
						openZohoChat();
					}}
				>
					Get Started
				</Button>
			</div>
		</div>
	</div>
);
