import { Link } from "react-router-dom";

const pastelColors = [
	'bg-blue-100 text-blue-400',
	'bg-purple-100 text-purple-400',
	'bg-pink-100 text-pink-400',
	'bg-emerald-100 text-emerald-400',
	'bg-amber-100 text-amber-400',
	'bg-indigo-100 text-indigo-400',
	'bg-teal-100 text-teal-400',
	'bg-fuchsia-100 text-fuchsia-400',
	'bg-rose-100 text-rose-400',
];

interface MenuItemLinkProps {
	to: string;
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	description?: string;
	index: number;
	onClick: () => void;
}

export const MenuItemLink = ({ to, icon: Icon, label, description, index, onClick }: MenuItemLinkProps) => (
	<Link
		to={to}
		onClick={onClick}
		className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors cursor-pointer group animate-fade-up [animation-duration:300ms]"
		style={{ animationDelay: `${index * 40}ms`, animationFillMode: "backwards" }}
	>
		<Icon className={`w-7 h-7 mt-1.5 p-[6px] opacity-90 shrink-0 rounded-lg ${pastelColors[index % pastelColors.length]}`} />
		<div>
			<span className="text-sm font-medium text-eko-navy">{label}</span>
			{description && (
				<p className="text-xs text-eko-slate/60 leading-tight mt-0.5">{description}</p>
			)}
		</div>
	</Link>
);

export interface DropdownGridColumn {
	title: string;
	items: Array<{
		to: string;
		icon: React.ComponentType<{ className?: string }>;
		label: string;
		description?: string;
	}>;
	seeAllLink?: {
		label: string;
		to: string;
	};
}

/**
 * Column header used in dropdown menus — title on the left, optional "see all" link on the right.
 */
export const DropdownColumnHeader = ({
	title,
	link,
}: {
	title: string;
	link?: { label: string; to: string; onClick?: () => void };
}) => (
	<div className="flex items-center justify-between mb-2 pb-2 px-3 border-b border-eko-navy/10">
		<h4 className="text-xs font-semibold text-eko-navy/60 uppercase tracking-wider">{title}</h4>
		{link && (
			<Link
				to={link.to}
				onClick={link.onClick}
				className="text-xs text-eko-navy/80 hover:text-eko-navy hover:underline font-medium"
			>
				{link.label}
			</Link>
		)}
	</div>
);

interface DropdownGridProps {
	columns: DropdownGridColumn[];
	onItemClick: () => void;
}

export const DropdownGrid = ({ columns, onItemClick }: DropdownGridProps) => (
	<div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-nowrap justify-center gap-5 xl:gap-10">
		{columns.map((col, colIndex) => (
			<div key={col.title} className="w-full max-w-[350px]">
				<DropdownColumnHeader
					title={col.title}
					link={col.seeAllLink ? { ...col.seeAllLink, onClick: onItemClick } : undefined}
				/>
				<div className="flex flex-col gap-0.5">
					{col.items.map((item, index) => (
						<MenuItemLink
							key={item.to}
							to={item.to}
							icon={item.icon}
							label={item.label}
							description={item.description}
							index={index + colIndex * 2}
							onClick={onItemClick}
						/>
					))}
				</div>
			</div>
		))}
	</div>
);
