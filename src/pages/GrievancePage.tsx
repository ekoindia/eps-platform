import { Phone, Mail, MapPin, Clock, ArrowRight, AlertTriangle, User, ExternalLink } from "lucide-react";
import { LegalPageLayout, SectionDivider } from "@/components/LegalPageLayout";

/* ─── Shared escalation data ─── */
const address = "Eko Bharat Ventures Private Limited, 68, Phase IV, Udyog Vihar, Sector 18, Gurugram, Haryana 122015";

/* ─── Table of contents ─── */
function TableOfContents() {
  return (
    <div className="border-l-4 border-primary bg-primary/5 rounded-r-xl p-5 mb-8">
      <ol className="list-decimal list-inside flex flex-col gap-2 text-sm">
        <li><a href="#customer-grievance-policy" className="text-primary font-semibold hover:underline">Customer Grievance Policy</a></li>
        <li><a href="#level-1" className="text-primary font-semibold hover:underline">Escalation Level 1</a></li>
        <li><a href="#level-2" className="text-primary font-semibold hover:underline">Escalation Level 2</a></li>
        <li><a href="#level-3" className="text-primary font-semibold hover:underline">Escalation Level 3</a></li>
        <li><a href="#report-unauthorized-transaction" className="text-primary font-semibold hover:underline">Report Unauthorized Transaction</a></li>
      </ol>
    </div>
  );
}

/* ─── Reusable escalation card ─── */
function EscalationLevel({ level, title, children, color }: { level: number; title: string; children: React.ReactNode; color: string }) {
  return (
    <div className={`rounded-xl border ${color} p-5`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-bold shrink-0">
          {level}
        </span>
        <h3 className="font-bold text-foreground text-lg">
          {title}
        </h3>
      </div>
      <div className="pl-11 flex flex-col gap-3 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function ContactRow({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground/70" />
      <span>{children}</span>
    </div>
  );
}

function EscalationArrow() {
  return (
    <div className="flex justify-center py-2">
      <ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN CONTENT
   ═══════════════════════════════════════════════════════════════════ */
function PolicyContent() {
  return (
    <section id="customer-grievance-policy">
      <h2 className="text-2xl font-bold text-accent mb-6">Customer Grievance Policy</h2>

      <p className="text-muted-foreground leading-relaxed mb-4">
        In today's competitive era and constantly evolving business, we at <strong className="text-foreground">Eko Bharat Ventures Private Limited (formerly known as Eko India Financial Services Private Limited)</strong> <em>('Company')</em> take pride in keeping our customers at the centre of all our strategies and initiatives, and are committed to deliver best in class customer service to all our existing and new customers at all times.
      </p>
      <p className="text-muted-foreground leading-relaxed mb-4">
        As a service organization we promote "Excellence in Delivery" and hence feedback from our valued customers forms an integral part of all decisions taken by the Company. The feedback provided by our customers is treated as an asset to the Company, evaluated and customized to improve our products and services.
      </p>
      <p className="text-muted-foreground leading-relaxed">
        This policy document aims at communicating the various mechanisms available for our customers to reach out to us, our service guarantee and timelines by which we will try and ensure resolution to our customer concerns.
      </p>

      <SectionDivider />

      <h3 className="font-bold text-foreground mb-3">Our Principles:</h3>
      <ul className="list-disc pl-6 flex flex-col gap-2 text-muted-foreground text-sm leading-relaxed">
        <li>Customers remain the Key focus for all initiatives and strategies developed in the Company.</li>
        <li>"Delighted" Customers are a necessity for business growth and survival.</li>
        <li>Our Customers and their Feedback is treated as the most valuable asset for the organization, forming the foundation for development and innovation.</li>
        <li>We endeavour to simplify our customer's life through our innovations and product offerings.</li>
        <li>Constantly evolve and invest in our grievance redressing systems for a seamless service delivery.</li>
      </ul>

      <SectionDivider />

      <h3 className="font-bold text-foreground mb-3">Our Promise:</h3>
      <ul className="list-disc pl-6 flex flex-col gap-2 text-muted-foreground text-sm leading-relaxed mb-4">
        <li>All grievances will be dealt with, promptly and courteously.</li>
        <li>We promise to resolve any or all issues faced by our customers effectively and within the communicated time frame.</li>
        <li>All Service Level Agreements and turnaround time for each third party transaction would be published on our website.</li>
        <li>The Company has a dedicated team to manage customer queries and ease out grievances if any.</li>
        <li>We value your feedback.</li>
      </ul>
      <p className="text-muted-foreground leading-relaxed text-sm">
        All customers have the right to share their feedback or complaint in case they find our services are not meeting their expectations or are dissatisfied with any interaction with any of our staff members.
      </p>

      <SectionDivider />

      {/* Escalation Levels */}
      <div className="flex flex-col gap-4" id="level-1">
        <EscalationLevel level={1} title="Escalation: Level 1" color="bg-primary/10 border-primary/30">
          <p className="font-semibold text-foreground">Our customers can inquire, insist, or complain through the following mediums:</p>
          <ContactRow icon={Phone}>
            <strong>Phone — Customer Engagement Centre:</strong> Our customers & agents can call us at Help Line: <strong>+91 924 027 8654</strong> from 8 AM to 8 PM on all working days except Government and Public Holidays.
          </ContactRow>
          <ContactRow icon={Mail}>
            <strong>Email:</strong> Customers can e-mail us at <a href="mailto:cs@eko.co.in" className="text-accent font-medium hover:underline">cs@eko.co.in</a>
          </ContactRow>
          <p className="text-xs">These mechanisms are dedicated for redressing customer complaints, providing online resolution wherever possible, and capturing valuable feedback regarding our services.</p>

          <div className="bg-muted/50 rounded-lg p-4 mt-2">
            <p className="font-semibold text-foreground text-xs mb-2">Customer Resolution Timelines:</p>
            <ul className="list-disc pl-4 flex flex-col gap-1 text-xs">
              <li>Customer Engagement Centre team will acknowledge the grievance within <strong>48 hours</strong> on receipt of complaint (email response or answering the call).</li>
              <li>A reference number will be provided for all future communication around the particular complaint.</li>
              <li>The customer care executive will try to resolve the issue within <strong>7 days</strong> after acknowledgement.</li>
              <li>All complaints would be closed based on the customer's feedback only and acceptance of closure.</li>
            </ul>
          </div>
          <p className="text-xs">If the complaint is not resolved within the given timelines or the response is unsatisfactory, the customer can escalate to Level 2 with relevant details such as the Complaint Reference Number. <strong>Note:</strong> escalations without a complaint reference number will not be treated as complaints.</p>
        </EscalationLevel>

        <EscalationArrow />

        {/* Level 2 */}
        <div id="level-2">
          <EscalationLevel level={2} title="Escalation: Level 2" color="bg-accent/5 border-accent/20">
            <p>In case the customer is not satisfied with the response from customer service executive, escalation to Level 2 can be triggered.</p>
            <ContactRow icon={User}><strong>Grievance Officer:</strong> Mr. Abhinav Sinha</ContactRow>
            <ContactRow icon={Mail}>Email: <a href="mailto:grievance@eko.co.in" className="text-accent font-medium hover:underline">grievance@eko.co.in</a></ContactRow>
            <ContactRow icon={MapPin}>Write to us: Customer Care, {address}</ContactRow>
            <ContactRow icon={Clock}>All escalations with the required details (reference number, contact details) would be addressed and resolved within <strong>24 hours</strong> up to a max of <strong>15 days</strong> in special cases pertaining to third party transactions.</ContactRow>
          </EscalationLevel>
        </div>

        <EscalationArrow />

        {/* Level 3 */}
        <div id="level-3">
          <EscalationLevel level={3} title="Escalation: Level 3" color="bg-destructive/5 border-destructive/20">
            <p>In case the customer is still not satisfied with the resolution provided or delay in response beyond the timelines communicated at Levels 1 & 2, the customer can escalate to the highest level:</p>
            <ContactRow icon={User}><strong>Nodal Officer:</strong> Mr. Abhinav Sinha</ContactRow>
            <ContactRow icon={Mail}>Email: <a href="mailto:nodaldesk@eko.co.in" className="text-accent font-medium hover:underline">nodaldesk@eko.co.in</a></ContactRow>
            <ContactRow icon={Phone}>Mobile: <strong>+91-9654280988</strong></ContactRow>
            <ContactRow icon={MapPin}>Write to us: Nodal Officer, {address}</ContactRow>
            <ContactRow icon={Clock}>Complaint will be acknowledged within <strong>24 hours</strong>. Resolution will be provided up to a maximum of <strong>7 days</strong>.</ContactRow>
          </EscalationLevel>
        </div>
      </div>

      <div className="mt-4 bg-muted rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Important:</strong> All complaints at Level 3 will be considered only if the complaint number given at Level 1 is included in the complaint.
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   REPORT UNAUTHORIZED TRANSACTION
   ═══════════════════════════════════════════════════════════════════ */
function ReportUnauthorizedTransaction() {
  return (
    <section id="report-unauthorized-transaction">
      <h2 className="text-2xl font-bold text-accent mb-6">Report Unauthorized Transaction</h2>
      <p className="text-muted-foreground leading-relaxed mb-4">
        If you believe an unauthorized or fraudulent transaction has occurred on your account, please report it immediately using the options below.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href="mailto:cs@eko.co.in?subject=Unauthorized%20Transaction%20Report"
          className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:scale-105 transition-transform text-sm"
        >
          <Mail className="w-4 h-4" />
          Report via Email
        </a>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function GrievancePage() {
  return (
    <LegalPageLayout
      title="Customer Grievance Redressal Mechanisms"
      subtitle="We are committed to resolving every concern — promptly and courteously"
      breadcrumb="Grievance"
      description="Eko's customer grievance redressal mechanisms, escalation levels, and contact details for resolving complaints."
    >
      <TableOfContents />
      <PolicyContent />
      <SectionDivider />
      <ReportUnauthorizedTransaction />
    </LegalPageLayout>
  );
}
