import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { FadeIn } from "@/components/FadeIn";
import type { IntegrationStep } from "@/components/ProductPageLayout";
import { SectionContainer } from "@/components/SectionContainer";
import { Button } from "@/components/ui/button";

interface IntegrationStepperSectionProps {
	integrationSteps: IntegrationStep[];
	/** Internal `/docs/<slug>` href for the product's primary API. */
	docHref?: string;
}

const LINK_CLASS =
	"inline-flex items-center gap-1 text-eko-gold hover:underline focus-visible:underline focus-visible:outline-none";

/**
 * Step title. Plain text unless the step carries an `href`, in which case the
 * title becomes a link — an absolute URL opens in a new tab, a path routes in-app.
 */
const StepTitle = ({ step }: { step: IntegrationStep }) => {
	if (!step.href) return <>{step.title}</>;
	const label = (
		<>
			{step.title}
			<ArrowRight className="w-3 h-3" />
		</>
	);
	return /^https?:\/\//.test(step.href) ? (
		<a
			href={step.href}
			target="_blank"
			rel="noopener noreferrer"
			className={LINK_CLASS}
		>
			{label}
		</a>
	) : (
		<Link to={step.href} className={LINK_CLASS}>
			{label}
		</Link>
	);
};

/**
 * "How to Integrate" stepper. Renders a single, SEO-friendly DOM structure
 * (each step's text appears once) that adapts via CSS: a vertical stepper on
 * mobile (number left, content right) and a horizontal stepper on desktop
 * (number above content). The connector line flips axis with `flex-1`, growing
 * vertically inside the mobile `flex-col` track and horizontally inside the
 * desktop `md:flex-row` track.
 */
export const IntegrationStepperSection = ({
	integrationSteps,
	docHref,
}: IntegrationStepperSectionProps) => {
	return (
		<SectionContainer className="bg-eko-navy">
			<FadeIn className="text-center mb-12">
				<h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
					How to Integrate
				</h2>
				<p className="text-white/70 max-w-2xl mx-auto">
					Get started in minutes with our simple integration process
				</p>
			</FadeIn>

			<ol className="flex flex-col md:flex-row md:items-start md:justify-center max-w-sm md:max-w-4xl mx-auto">
				{integrationSteps.map((step, i) => {
					const isLast = i === integrationSteps.length - 1;
					return (
						<FadeIn
							key={i}
							as="li"
							delay={i * 150}
							className="flex flex-1 gap-4 md:flex-col md:items-center md:text-center"
						>
							{/* Marker + connector track: vertical on mobile, horizontal on desktop.
                  Desktop: circle centered in column; connector absolutely positioned
                  from this circle's right edge to the next column's circle. */}
							<div className="relative flex flex-col items-center md:w-full">
								<div className="flex h-10 w-10 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-full bg-eko-gold font-bold text-eko-navy text-sm md:text-lg">
									{i + 1}
								</div>
								{!isLast && (
									<div className="bg-white/20 w-0.5 flex-1 mt-2 md:mt-0 md:absolute md:top-1/2 md:-translate-y-1/2 md:left-[calc(50%+2.25rem)] md:right-[calc(-50%+2.25rem)] md:h-0.5 md:w-auto" />
								)}
							</div>

							{/* Content — rendered once */}
							<div className="pb-6 md:pb-0 md:mt-3 md:max-w-[140px]">
								<h3 className="text-sm font-semibold text-white">
									<StepTitle step={step} />
								</h3>
								<p className="text-white/70 text-xs mt-1">{step.desc}</p>
								{step.tip && (
									<p className="text-eko-gold/80 text-xs mt-1 italic">
										{step.tip}
									</p>
								)}
							</div>
						</FadeIn>
					);
				})}
			</ol>

			{docHref && (
				<div className="text-center mt-10">
					<Button variant="gold" size="lg" asChild>
						<Link to={docHref}>
							View Documentation
							<ArrowRight className="w-4 h-4" />
						</Link>
					</Button>
				</div>
			)}
		</SectionContainer>
	);
};
