import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";

const ReverseGeocodingPage = () => {
  return (
    <>
      <Helmet>
        <title>Reverse Geocoding API | Location to Address Resolution | Eko</title>
        <meta name="description" content="Integrate Reverse Geocoding API to convert latitude and longitude into accurate, structured address data for verification and compliance." />
        <meta name="keywords" content="Reverse Geocoding API, Location Verification API, Address Resolution API, Latitude Longitude to Address API, Geo Verification API" />
        <link rel="canonical" href="https://eko.in/products/reverse-geocoding-api" />
        <meta property="og:title" content="Reverse Geocoding API | Location to Address Resolution | Eko" />
        <meta property="og:description" content="Convert geo-coordinates into precise address data to strengthen verification and compliance workflows." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="Reverse Geocoding API"
        description="Convert coordinates to addresses"
        heroTitle="Reverse Geocoding API for Location-Based Verification"
        heroSubtitle="Convert geo-coordinates into precise address data to strengthen verification and compliance workflows."
        category="verification"
        docsUrl="https://eko.in/developers/eps/reverse-geocoding-api/"
        overview="The Reverse Geocoding API enables businesses to translate latitude and longitude coordinates into structured address information. It is designed for address validation, geo-compliance checks, and location-based risk assessment."
        keyBenefits={[
          "Accurate latitude-to-address conversion",
          "Improves address and location verification",
          "Supports geo-compliance and risk checks",
          "Automation-ready for digital workflows",
          "Scales for high-volume location lookups"
        ]}
        features={[
          { title: "Coordinate to Address Resolution", description: "Convert latitude and longitude into structured, readable address data." },
          { title: "Location Accuracy", description: "Helps validate whether users or devices are operating from expected locations." },
          { title: "Automation Friendly", description: "Integrates easily into onboarding, verification, and monitoring systems." },
          { title: "High-Volume Ready", description: "Designed to handle frequent and large-scale geolocation queries." }
        ]}
        whoShouldUse={[
          "Fintechs and regulated platforms",
          "Enterprises verifying customer locations",
          "Field service and agent-based operations",
          "Platforms performing geo-risk analysis"
        ]}
        useCases={[
          "Address verification during onboarding",
          "Geo-compliance and location validation",
          "Fraud detection and risk assessment",
          "Field agent or device location checks"
        ]}
        trustAndCompliance={[
          "Secure API authentication",
          "Encrypted request and response handling",
          "Compliance-aligned data processing",
          "Audit-ready lookup records"
        ]}
        integrationSteps={[
          { step: 1, title: "Sign Up", description: "Create an account on Connect App." },
          { step: 2, title: "Submit Documents", description: "Submit necessary documents." },
          { step: 3, title: "Integrate API", description: "Pass latitude and longitude to our API." },
          { step: 4, title: "Go Live", description: "Start resolving addresses in production." }
        ]}
        leadForm={{
          title: "Get Reverse Geocoding API Access",
          fields: [
            { name: "company_name", label: "Company Name", type: "text", required: true },
            { name: "contact_person", label: "Contact Person", type: "text", required: true },
            { name: "email", label: "Business Email", type: "email", required: true },
            { name: "mobile", label: "Mobile Number", type: "tel", required: true },
            { name: "lookup_volume", label: "Expected Monthly Lookups", type: "select", options: ["Less than 10,000", "10,000 – 100,000", "100,000 – 1,000,000", "1,000,000+"] }
          ],
          cta: "Request Reverse Geocoding API"
        }}
        faqs={[
          { question: "How accurate is the address returned?", answer: "Accuracy depends on GPS precision. With standard coordinates, we return correct locality, city, and pincode." },
          { question: "What address components are returned?", answer: "We return formatted address, area/locality, city, district, state, pincode, and country." },
          { question: "Can I use this for fraud detection?", answer: "Yes, you can cross-check customer-provided addresses against GPS-derived addresses for fraud prevention." },
          { question: "What is the rate limit?", answer: "Rate limits depend on your plan. Contact us for higher throughput requirements." }
        ]}
      />
    </>
  );
};

export default ReverseGeocodingPage;
