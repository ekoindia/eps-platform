import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { Shield, Lock, FileCheck } from "lucide-react";
import { FadeIn } from "@/components/FadeIn";
import { Picture } from "@/components/Picture";
import airtelLogo from "@/assets/partners/airtel-payments-bank.png?w=120;240&format=avif;webp&as=picture";
import finoLogo from "@/assets/partners/fino-payments-bank.png?w=120;240&format=avif;webp&as=picture";
import razorpayLogo from "@/assets/partners/razorpay.png?w=120;240&format=avif;webp&as=picture";
import fingpayLogo from "@/assets/partners/fingpay.png?w=120;240&format=avif;webp&as=picture";
import billdeskLogo from "@/assets/partners/billdesk.png?w=120;240&format=avif;webp&as=picture";
import payuLogo from "@/assets/partners/payu.png?w=120;240&format=avif;webp&as=picture";
import prabhuLogo from "@/assets/partners/prabhu.png?w=120;240&format=avif;webp&as=picture";
import moneycartLogo from "@/assets/partners/moneycart.png?w=120;240&format=avif;webp&as=picture";

const partners = [
	{ name: "Airtel Payments Bank", logo: airtelLogo },
	{ name: "Fino Payments Bank", logo: finoLogo },
	{ name: "Razorpay", logo: razorpayLogo },
	{ name: "Fingpay", logo: fingpayLogo },
	{ name: "BillDesk", logo: billdeskLogo },
	{ name: "PayU", logo: payuLogo },
	{ name: "Prabhu Money Transfer", logo: prabhuLogo },
	{ name: "MoneyCart", logo: moneycartLogo },
];

const complianceItems = [
	{
		icon: Shield,
		title: "RBI Compliant",
		description:
			"Compliant with Reserve Bank of India regulations for payment services and banking correspondent operations.",
		details: [
			"Authorised BC operations",
			"Data residency: India",
			"Audit & reporting: logs, reconciliation, settlement reports",
		],
	},
	{
		icon: Lock,
		title: "KYC Compliant",
		description:
			"Full Know Your Customer compliance for onboarding and identity verification across all services.",
	},
	{
		icon: FileCheck,
		title: "AML/CFT Compliant",
		description:
			"Anti-Money Laundering and Counter Financing of Terrorism compliance built into every transaction.",
	},
];

export const ComplianceSection = () => {
	return (
		<SectionContainer variant="muted" id="compliance">
			<FadeIn>
				<SectionHeader
					title="Security & Compliance First"
					subtitle="Enterprise-grade security with complete regulatory compliance. Your data and transactions are always protected."
				/>
			</FadeIn>

			<div className="grid md:grid-cols-3 gap-6 lg:gap-8">
				{complianceItems.map((item, i) => (
					<FadeIn
						key={item.title}
						delay={i * 100}
						className="p-6 rounded-2xl bg-card border border-border/50 card-hover"
					>
						<div className="w-12 h-12 rounded-xl bg-eko-gold/20 flex items-center justify-center mb-5">
							<item.icon className="w-6 h-6 text-eko-gold" />
						</div>
						<h3 className="text-lg font-semibold text-foreground mb-2">
							{item.title}
						</h3>
						<p className="text-muted-foreground text-sm leading-relaxed">
							{item.description}
						</p>
						{"details" in item && item.details && (
							<ul className="mt-3 flex flex-col gap-1.5">
								{(item.details as string[]).map((detail: string, i: number) => (
									<li
										key={i}
										className="text-muted-foreground text-xs flex items-start gap-1.5"
									>
										<span className="mt-1 w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0" />
										{detail}
									</li>
								))}
							</ul>
						)}
					</FadeIn>
				))}
			</div>

			{/* Partner Logos */}
			<FadeIn className="mt-16 pt-12 border-t border-border/50">
				<h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground text-center mb-8">
					Our Partners
				</h2>
				<div className="relative overflow-hidden h-20">
					<div className="flex items-center gap-12 animate-scroll-x">
						{[...partners, ...partners].map((partner, i) => (
							<Picture
								key={`${partner.name}-${i}`}
								src={partner.logo}
								alt={partner.name}
								sizes="120px"
								loading="lazy"
								className="h-12 w-auto object-contain bg-white rounded-lg px-4 py-2 shrink-0"
							/>
						))}
					</div>
				</div>
			</FadeIn>
		</SectionContainer>
	);
};
