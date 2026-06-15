import LegalPageLayout from "@/components/LegalPageLayout";

const RefundPolicyPage = () => {
	return (
		<LegalPageLayout
			title="Refund & Cancellation Policy"
			description="Read Eko's refund and cancellation policy for payment and verification API services."
		>
			<p>
				By accessing and using products/services of Eko Bharat Ventures Private
				Limited (henceforth referred to as "<strong>Eko</strong>"), you accept
				and agree to the terms, conditions and rules without limitation and or
				qualification.
			</p>
			<p>
				We reserve the right to modify the terms at any time without giving you
				any prior notice. Your use of Eko following any such modification
				constitutes your agreement to follow and be bound by the terms as
				modified.
			</p>
			<p>
				Eko does not at any point of time during any transaction between the
				user and merchant/vendor take the ownership of any of the
				products/services provided by the merchant. The cancellation/refund, if
				any, will be governed as per the terms and conditions of the aggregator
				or of the merchant/vendor.
			</p>
			<p>
				In the event you erroneously send a payment to a wrong party or have
				sent a payment for a wrong amount, Eko shall have no liability in this
				regard and your only recourse will be to contact such third party to
				whom such payment was sent and seek a refund (if any).
			</p>
			<p>
				All sales of prepaid recharge on the Eko platform are final with no
				refund or exchange permitted. You are responsible for the mobile number
				or the account number for which you purchased the prepaid recharge.
			</p>
			<p>
				Eko disclaims any accountability, legal, losses/damages or else, that
				might arise because of the act, omission or otherwise of any user on its
				website/mobile application. You expressly admit that Eko is only a
				payment facilitator & intermediary.
			</p>
			<p>
				Any payment made erroneously by the user to any merchant establishment
				or any erroneous transfer to any person shall not be refunded to the
				user by Eko in any circumstances.
			</p>

			<h2>Refund Types</h2>
			<p>
				Following are the various types of refunds that you can use to refund
				payments to your customers:
			</p>

			<h3>1. Normal Refund</h3>
			<p>Amount is refunded within 5 – 7 working days.</p>

			<h3>2. Instant Refund</h3>
			<p>
				Amount is refunded almost immediately. By issuing instant refunds to
				your customers, you can provide a better user experience. This also
				helps in improving their reliability and trust in your business.
			</p>

			<h2>Handle Refund Chargeback</h2>
			<p>
				For the prevention of chargebacks, Eko only does source refunds. It
				means that money is refunded to the payment method that the customer
				used to make the payment. For example, if a credit card was used to make
				the payment, the refund is pushed to the same credit card.
			</p>
			<p>
				If a chargeback is received for an instantly refunded payment, the
				processed refund will have a UTR (Unique Transfer Reference) in the
				callback. The UTR serves as a proof of refund completed between you and
				Eko.
			</p>

			<blockquote>
				For any query on payment related issues, contact us directly on{" "}
				<strong>+91 924 027 8654</strong>
			</blockquote>

			<h2>Our Address</h2>
			<p>
				<strong>Eko Bharat Ventures Private Limited</strong>,<br />
				68, Phase IV, Udyog Vihar, Sector 18, Gurugram, Haryana 122015.
				<br />
				Phone: +91 924 027 8654
			</p>
		</LegalPageLayout>
	);
};

export default RefundPolicyPage;
