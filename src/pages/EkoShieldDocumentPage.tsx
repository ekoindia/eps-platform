import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import { Link } from "react-router-dom";
import ekoShieldLogo from "@/assets/eko-shield-logo.png";

const EkoShieldDocumentPage = () => {
  const handleDownload = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Eko Shield - Product Document</title>
        <meta name="description" content="Complete product document for Eko Shield - India's unified verification platform." />
      </Helmet>

      {/* Top bar - hidden in print */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/products/eko-shield">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Eko Shield
            </Link>
          </Button>
          <Button variant="gold" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" /> Download PDF
          </Button>
        </div>
      </div>

      {/* Document content */}
      <div className="max-w-4xl mx-auto px-8 py-12 print:px-0 print:py-0 text-gray-900">

        {/* Cover / Header */}
        <div className="text-center mb-16 print:mb-10">
          <img src={ekoShieldLogo} alt="Eko Shield" className="h-16 mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-[#00394b] mb-3">Eko Shield</h1>
          <p className="text-xl text-gray-600">Unified Verification Platform — Product Overview</p>
          <div className="mt-4 text-sm text-gray-400">Confidential • {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })}</div>
        </div>

        <hr className="mb-10 border-gray-200" />

        {/* Section: What is Eko Shield */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#00394b] mb-4">What is Eko Shield?</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Eko Shield is a <strong>unified verification platform</strong> that replaces fragmented verification processes with one scalable trust infrastructure. It provides real-time identity, financial, and compliance checks through a centralized control dashboard — available via API or a no-code portal.
          </p>
          <p className="text-lg font-medium text-[#00394b] italic">
            "One Platform. Complete Control. Zero Compliance Gaps."
          </p>
        </section>

        {/* Section: Key Metrics */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#00394b] mb-4">Key Metrics</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: "99.9%", label: "Verified Accuracy" },
              { value: "<1s", label: "Response Time" },
              { value: "500+", label: "Businesses Trust Us" },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-3xl font-bold text-[#00394b]">{stat.value}</div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Section: Core Value Propositions */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#00394b] mb-4">Core Value Propositions</h2>
          <div className="space-y-4">
            {[
              { title: "Sub-Second Verification", desc: "Every check completes in under 1 second. Aadhaar, PAN, Bank, GST, DL, RC — all instant." },
              { title: "Centralized Compliance", desc: "One dashboard for audit logs, branch-level visibility, and regulatory compliance tracking." },
              { title: "Operational Control", desc: "No-code dashboard to manage verification workflows. Role-based access across teams and branches." },
              { title: "Fraud Reduction", desc: "Catch fake identities, expired documents, and mismatched bank details before they cost you." },
            ].map((prop) => (
              <div key={prop.title} className="flex gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="w-2 bg-[#C8A951] rounded-full flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-[#00394b] mb-1">{prop.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{prop.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section: How It Works */}
        <section className="mb-12 break-before-page-auto print:break-before-page">
          <h2 className="text-2xl font-bold text-[#00394b] mb-4">How It Works</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { num: "01", title: "Connect", desc: "Integrate via API or use our no-code dashboard. Go live in under 30 minutes." },
              { num: "02", title: "Verify", desc: "Run Aadhaar, PAN, Bank Account, GST, DL, RC, and 50+ checks in real-time." },
              { num: "03", title: "Control", desc: "Monitor all verifications from one dashboard. Set roles, branches, and audit trails." },
              { num: "04", title: "Scale", desc: "From 100 to 100,000 verifications per month. Pricing grows with you." },
            ].map((step) => (
              <div key={step.num} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="text-2xl font-bold text-[#C8A951] mb-1">{step.num}</div>
                <h3 className="font-semibold text-[#00394b] mb-1">{step.title}</h3>
                <p className="text-sm text-gray-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section: Verification Products */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#00394b] mb-4">Verification Products (50+ Checks)</h2>

          {[
            { category: "Identity", items: ["PAN Lite", "PAN Advanced", "PAN Comprehensive", "PAN Verify", "Passport", "CKYC Download"] },
            { category: "GSTIN", items: ["GSTIN Verify", "GSTIN by PAN", "GST Basic", "GST by PAN", "GST Advanced"] },
            { category: "Financial", items: ["Bank Account Verify", "Instant Account Verify", "Penny Drop Verify", "Mobile to UPI"] },
            { category: "Employment", items: ["Employment Insights", "Name Match", "ITR Compliance"] },
            { category: "Vehicle", items: ["Driving License", "E-Challan"] },
            { category: "Digital", items: ["IP Intelligence", "Reverse Geocode", "Email Verify"] },
            { category: "Healthcare", items: ["Doctor Verify"] },
          ].map((cat) => (
            <div key={cat.category} className="mb-4">
              <h3 className="font-semibold text-[#00394b] mb-2">{cat.category}</h3>
              <div className="flex flex-wrap gap-2">
                {cat.items.map((item) => (
                  <span key={item} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm border border-gray-200">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Section: Industries */}
        <section className="mb-12 print:break-before-page">
          <h2 className="text-2xl font-bold text-[#00394b] mb-6">Industries Served</h2>

          <div className="space-y-6">
            {[
              { name: "NBFC & Lending", tagline: "Branch-level KYC with audit control", pain: "Slow KYC processing, RBI audit pressure, and fragmented branch-level verification workflows cause TAT delays and compliance exposure.", solution: "Centralizes branch-level KYC with audit logs, reducing loan processing TAT by up to 30%. Automated Aadhaar, PAN, and bank verification ensures RBI compliance.", benefits: ["Reduce loan TAT by 30%", "Centralized audit trail", "Automated RBI compliance", "Real-time fraud detection"] },
              { name: "Fintech & Neobanks", tagline: "API + compliance dashboard", pain: "Multiple API vendors, no centralized compliance visibility, and growing regulatory pressure make scaling risky.", solution: "One verification infrastructure. Compliance teams get a real-time dashboard while developers get sub-second APIs.", benefits: ["One API for 50+ types", "Real-time compliance dashboard", "Sub-second response times", "SOC 2 & ISO 27001 compliant"] },
              { name: "Staffing & HR", tagline: "Verify before you deploy", pain: "Fake candidates with forged documents slip through manual verification, creating liability.", solution: "Verifies identity, education, and criminal records instantly before deployment.", benefits: ["Instant candidate verification", "Reduce deployment delays", "Eliminate fake candidate risk", "Bulk verification workflows"] },
              { name: "Logistics & Delivery", tagline: "Driver & fleet verification", pain: "Unverified drivers with expired DLs can shut down fleet operations and cause regulatory penalties.", solution: "Automates DL, RC, and identity verification for entire fleets with expiry alerts.", benefits: ["Automated DL & RC verification", "Document expiry alerts", "Hub-level compliance", "Insurance claim readiness"] },
              { name: "Marketplaces & E-commerce", tagline: "Vendor onboarding checks", pain: "Fake sellers and unverified vendors lead to wrong payouts and trust erosion.", solution: "Verifies vendor identity, bank accounts, and GST before onboarding.", benefits: ["Prevent fraudulent vendors", "Bank account verification", "GST & PAN validation", "Automated onboarding"] },
              { name: "Travel & Hospitality", tagline: "Booking fraud prevention", pain: "Fraudulent bookings with stolen identities cost revenue and damage trust.", solution: "Adds a verification layer for high-value bookings, confirming identity in seconds.", benefits: ["Real-time identity verification", "High-value booking protection", "Reduce chargeback fraud", "Seamless experience"] },
              { name: "Agro Platforms", tagline: "Secure procurement payments", pain: "Bank account mismatches in farmer payments lead to failed transfers and financial leakage.", solution: "Validates farmer bank accounts and identity before procurement payments.", benefits: ["Bank account validation", "Farmer identity verification", "Reduce payment failures", "Regional compliance support"] },
              { name: "Insurance", tagline: "Instant claim verification", pain: "Fraudulent claims with fake documents cost insurers millions annually.", solution: "Automates claimant identity and document verification, catching fraud before payout.", benefits: ["Instant claimant verification", "Document fraud detection", "Reduce claim processing time", "Automated audit compliance"] },
            ].map((ind) => (
              <div key={ind.name} className="p-5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-baseline gap-2 mb-1">
                  <h3 className="text-lg font-bold text-[#00394b]">{ind.name}</h3>
                  <span className="text-sm text-[#C8A951] font-medium">— {ind.tagline}</span>
                </div>
                <p className="text-sm text-gray-500 mb-2"><strong>Pain Point:</strong> {ind.pain}</p>
                <p className="text-sm text-gray-700 mb-3"><strong>Solution:</strong> {ind.solution}</p>
                <div className="flex flex-wrap gap-2">
                  {ind.benefits.map((b) => (
                    <span key={b} className="text-xs px-2.5 py-1 bg-[#00394b]/5 text-[#00394b] rounded-full font-medium">✓ {b}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="text-center pt-8 border-t border-gray-200 text-sm text-gray-400">
          <p>© {new Date().getFullYear()} Eko Bharat Ventures Pvt. Ltd. All rights reserved.</p>
          <p className="mt-1">For demos and inquiries, visit <strong>eps.eko.in</strong></p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:break-before-page { break-before: page; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
};

export default EkoShieldDocumentPage;
