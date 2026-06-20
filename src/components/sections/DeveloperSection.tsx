import {
	CodeBlock,
	exampleIntegrationSteps,
	examplePaymentCode,
} from "@/components/CodeBlock";
import { FadeIn } from "@/components/FadeIn";
import { SectionContainer } from "@/components/SectionContainer";
import { Button } from "@/components/ui/button";
import { ArrowRight, Code, Key, Zap } from "lucide-react";

const stepIcons = [Code, Key, Zap];

export const DeveloperSection = () => {
	return (
		<SectionContainer variant="muted" id="developers">
			<div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
				{/* Left: Content */}
				<FadeIn>
					<span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-4 bg-eko-gold-light text-eko-navy">
						For Developers
					</span>
					<h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
						Build with Confidence
					</h2>
					<p className="text-lg text-muted-foreground mb-8 leading-relaxed">
						Comprehensive documentation, SDKs, and sandbox environments to help
						you integrate Eko APIs in minutes, not weeks.
					</p>

					{/* Integration Steps */}
					<div className="flex flex-col gap-6 mb-10">
						{exampleIntegrationSteps.map((step, index) => {
							const Icon = stepIcons[index];
							return (
								<FadeIn
									key={step.step}
									delay={index * 100}
									className="flex items-start gap-4"
								>
									<div className="w-12 h-12 rounded-xl bg-eko-gold/10 flex items-center justify-center shrink-0">
										<Icon className="w-5 h-5 text-eko-gold" />
									</div>
									<div>
										<div className="flex items-center gap-2 mb-1">
											<span className="text-xs font-bold text-eko-gold">
												STEP {step.step}
											</span>
											<span className="font-semibold text-foreground">
												{step.title}
											</span>
										</div>
										<p className="text-muted-foreground text-sm">
											{step.description}
										</p>
									</div>
								</FadeIn>
							);
						})}
					</div>

					<Button variant="gold" size="lg" asChild>
						<a href="/docs">
							Go to Developer Docs
							<ArrowRight className="w-4 h-4" />
						</a>
					</Button>
				</FadeIn>

				{/* Right: Code Block */}
				<FadeIn delay={200} className="relative overflow-hidden">
					<div className="absolute -inset-4 bg-eko-gold/5 rounded-2xl blur-2xl" />
					<CodeBlock
						code={examplePaymentCode}
						fileName="transfer.js"
						className="relative"
					/>
				</FadeIn>
			</div>
		</SectionContainer>
	);
};
