import type { IconComponent } from "@/components/icons/types";
import {
	SUPPORT_EMAIL,
	SUPPORT_PHONE,
	SUPPORT_WHATSAPP,
} from "@/lib/config/features";
import { formatMobile } from "@/lib/utils";
import { Mail, Phone } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

/** A channel that survived normalisation and is worth rendering. */
type Channel = {
	key: string;
	href: string;
	label: string;
	/** Accessible name — the visible text alone repeats across phone/WhatsApp. */
	ariaLabel: string;
	Icon: IconComponent;
	external?: boolean;
};

/**
 * Digits of a phone number in E.164 form, without the `+`, or `""` when there is
 * no number there at all.
 *
 * The env vars carry a bare national number (`9876543210`), which `tel:` and
 * `wa.me` both want country-coded — so a 10-digit value gets `91`. Anything
 * longer is assumed to already carry its country code; anything with no digits
 * is not a number and hides its channel rather than linking to nowhere.
 */
function e164(raw: string): string {
	const digits = raw.replace(/\D/g, "");
	if (!digits) return "";
	return digits.length === 10 ? `91${digits}` : digits;
}

/**
 * Support contact strip, at the foot of Console Home.
 *
 * Every channel comes from the environment (`VITE_SUPPORT_*`), so a deployment
 * can offer one, two, all three, or none. Nothing renders when none are set:
 * an empty "Need help?" line is a promise with no phone number behind it.
 *
 * The props exist only as a test seam — they default to the module constants,
 * which are read once at import and so cannot be varied per test case.
 */
export default function SupportContact({
	email = SUPPORT_EMAIL,
	phone = SUPPORT_PHONE,
	whatsapp = SUPPORT_WHATSAPP,
}: {
	email?: string;
	phone?: string;
	whatsapp?: string;
} = {}) {
	const channels: Channel[] = [];

	// Normalise BEFORE deciding a channel exists: a whitespace-only var is not a
	// contact, and a WhatsApp number with no digits would build `wa.me/`.
	const mail = email.trim();
	if (mail) {
		channels.push({
			key: "email",
			href: `mailto:${mail}`,
			label: mail,
			ariaLabel: `Email support at ${mail}`,
			Icon: Mail,
		});
	}

	const tel = e164(phone);
	if (tel) {
		channels.push({
			key: "phone",
			href: `tel:+${tel}`,
			label: formatMobile(phone.trim()),
			ariaLabel: `Call support at ${formatMobile(phone.trim())}`,
			Icon: Phone,
		});
	}

	const wa = e164(whatsapp);
	if (wa) {
		channels.push({
			key: "whatsapp",
			href: `https://wa.me/${wa}`,
			label: formatMobile(whatsapp.trim()),
			ariaLabel: `WhatsApp support at ${formatMobile(whatsapp.trim())}`,
			Icon: FaWhatsapp,
			// New tab: wa.me is a third party, and navigating away would drop the
			// partner out of a console page they may be mid-task on.
			external: true,
		});
	}

	if (channels.length === 0) return null;

	return (
		<div className="mt-6 border-t pt-6 text-xs text-muted-foreground opacity-90">
			<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
				<span className="font-medium text-eko-navy dark:text-foreground">
					Need help?
				</span>
				{channels.map(({ key, href, label, ariaLabel, Icon, external }) => (
					<a
						key={key}
						href={href}
						aria-label={ariaLabel}
						{...(external
							? { target: "_blank", rel: "noopener noreferrer" }
							: {})}
						className="flex items-center gap-2 text-eko-gold-ink underline-offset-4 hover:underline dark:text-eko-gold"
					>
						{/* No `aria-hidden`: the anchor's `aria-label` already fixes the
						    accessible name, and `IconComponent` takes `className` only. */}
						<Icon className="h-4 w-4 shrink-0" />
						{label}
					</a>
				))}
			</div>
		</div>
	);
}
