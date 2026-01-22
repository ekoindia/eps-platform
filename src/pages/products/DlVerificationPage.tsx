import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { IdCard, Shield, Zap, CheckCircle, Car, Calendar, FileText, Users } from "lucide-react";

const DlVerificationPage = () => {
  return (
    <>
      <Helmet>
        <title>Driving License Verification API - DL Validation | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Verify driving licenses instantly with Eko's DL Verification API. Check validity, license class, holder details from SARATHI database for mobility and logistics." 
        />
        <meta name="keywords" content="driving license verification API, DL verification API, SARATHI API, license validation API, driver verification, Eko API" />
        <link rel="canonical" href="https://eko.in/products/dl-verification-api" />
        <meta property="og:title" content="Driving License Verification API - DL Validation | Eko" />
        <meta property="og:description" content="Verify driving licenses instantly from SARATHI database." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="DL Verification API"
        description="Verify driving licenses from SARATHI database"
        heroTitle="Driving License Verification"
        heroSubtitle="Verify driving licenses instantly against the official SARATHI database. Get holder details, license class, validity, and more for driver onboarding."
        category="verification"
        docsUrl="https://developers.eko.in/docs/dl-verification"
        features={[
          {
            title: "Instant Verification",
            description: "Real-time DL verification from government SARATHI database.",
            icon: Zap
          },
          {
            title: "Holder Details",
            description: "Get name, father's name, address, and photo of license holder.",
            icon: Users
          },
          {
            title: "License Class",
            description: "Check authorized vehicle classes - LMV, HMV, Transport, etc.",
            icon: Car
          },
          {
            title: "Validity Status",
            description: "Verify if license is valid, expired, suspended, or revoked.",
            icon: Calendar
          },
          {
            title: "Issue & Expiry Dates",
            description: "Get complete timeline of license validity.",
            icon: FileText
          },
          {
            title: "All States Covered",
            description: "Pan-India coverage across all state RTOs.",
            icon: CheckCircle
          }
        ]}
        benefits={[
          {
            title: "Fast Driver Onboarding",
            description: "Verify driver credentials instantly for mobility platforms.",
            icon: Zap
          },
          {
            title: "Compliance Assurance",
            description: "Ensure only valid license holders operate vehicles.",
            icon: Shield
          },
          {
            title: "Fraud Prevention",
            description: "Detect fake or tampered driving licenses.",
            icon: IdCard
          },
          {
            title: "Risk Mitigation",
            description: "Verify license class matches vehicle type being driven.",
            icon: CheckCircle
          },
          {
            title: "Automated Checks",
            description: "Schedule periodic re-verification for license renewals.",
            icon: Calendar
          },
          {
            title: "Detailed Records",
            description: "Maintain verification logs for audit and compliance.",
            icon: FileText
          }
        ]}
        integrationSteps={[
          {
            step: 1,
            title: "Sign Up",
            description: "Create an account on Connect App."
          },
          {
            step: 2,
            title: "Get Credentials",
            description: "Receive sandbox API credentials."
          },
          {
            step: 3,
            title: "Integrate",
            description: "Add DL verification to driver onboarding."
          },
          {
            step: 4,
            title: "Test",
            description: "Test with sample DL numbers in sandbox."
          },
          {
            step: 5,
            title: "Go Live",
            description: "Switch to production and start verifying."
          }
        ]}
        useCases={[
          "Ride-Hailing Apps",
          "Delivery Platforms",
          "Fleet Management",
          "Car Rentals",
          "Logistics Companies",
          "Insurance Underwriting",
          "HR Verification",
          "Driver Training Schools"
        ]}
        faqs={[
          {
            question: "What information is returned?",
            answer: "We return holder name, father's name, date of birth, address, license number, issue date, expiry date, vehicle classes authorized, blood group, and photo (where available)."
          },
          {
            question: "Are all states supported?",
            answer: "Yes, we support DL verification across all Indian states and union territories through integration with the SARATHI database maintained by the Ministry of Road Transport."
          },
          {
            question: "Can I verify license class for specific vehicles?",
            answer: "Yes, the response includes all vehicle classes the holder is authorized to drive. You can validate if they're authorized for your specific vehicle type (LMV, HMV, Transport, etc.)."
          },
          {
            question: "How current is the data?",
            answer: "Data is fetched in real-time from SARATHI. Any updates like renewal, suspension, or revocation are reflected immediately in verification results."
          },
          {
            question: "What if the DL number is invalid?",
            answer: "Invalid or non-existent DL numbers return an error response, helping you detect fake documents instantly."
          }
        ]}
      />
    </>
  );
};

export default DlVerificationPage;
