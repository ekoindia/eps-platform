import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { Car, Shield, Zap, CheckCircle, FileText, Users, CreditCard, Search } from "lucide-react";

const VehicleVerificationPage = () => {
  return (
    <>
      <Helmet>
        <title>Vehicle Verification API - RC & DL Verification | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Verify vehicle RC and driving license with Eko's Vehicle Verification API. Registration certificate validation, DL verification, chassis number check for mobility services." 
        />
        <meta name="keywords" content="vehicle verification API, RC verification API, driving license API, DL verification, registration certificate API, Eko API" />
        <link rel="canonical" href="https://eko.in/products/vehicle-verification-api" />
        <meta property="og:title" content="Vehicle Verification API - RC & DL Verification | Eko" />
        <meta property="og:description" content="Verify vehicle RC and driving license for mobility and logistics services." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="Vehicle Verification API"
        description="Verify vehicle RC and driving license for mobility services"
        heroTitle="Vehicle & Driver Verification"
        heroSubtitle="Verify vehicle registration certificates and driving licenses instantly. Essential for ride-hailing, logistics, insurance, and fleet management operations."
        category="verification"
        docsUrl="https://developers.eko.in/docs/vehicle-verification"
        features={[
          {
            title: "RC Verification",
            description: "Verify vehicle registration certificate with owner details and vehicle information.",
            icon: Car
          },
          {
            title: "DL Verification",
            description: "Validate driving license with class, validity, and holder details.",
            icon: FileText
          },
          {
            title: "Chassis Verification",
            description: "Verify chassis number to validate vehicle authenticity.",
            icon: Search
          },
          {
            title: "Owner Details",
            description: "Get registered owner name and address for vehicle.",
            icon: Users
          },
          {
            title: "Validity Check",
            description: "Check if RC/DL is valid, expired, or suspended.",
            icon: CheckCircle
          },
          {
            title: "Insurance Status",
            description: "Verify if vehicle has active insurance coverage.",
            icon: Shield
          }
        ]}
        benefits={[
          {
            title: "Driver Onboarding",
            description: "Verify driver documents before onboarding for ride-hailing and delivery platforms.",
            icon: Users
          },
          {
            title: "Fleet Compliance",
            description: "Ensure all fleet vehicles have valid RC, insurance, and fitness certificates.",
            icon: CheckCircle
          },
          {
            title: "Insurance Verification",
            description: "Verify vehicle details for motor insurance underwriting and claims.",
            icon: Shield
          },
          {
            title: "Fraud Prevention",
            description: "Detect fake or invalid documents during verification process.",
            icon: Shield
          },
          {
            title: "Instant Results",
            description: "Real-time verification from RTO databases across India.",
            icon: Zap
          },
          {
            title: "Loan Verification",
            description: "Verify vehicle details for vehicle finance and loan applications.",
            icon: CreditCard
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
            description: "Receive API credentials for sandbox testing."
          },
          {
            step: 3,
            title: "Integrate API",
            description: "Add vehicle verification to your onboarding flow."
          },
          {
            step: 4,
            title: "Test",
            description: "Test with sample RC/DL numbers in sandbox."
          },
          {
            step: 5,
            title: "Go Live",
            description: "Deploy with production credentials."
          }
        ]}
        useCases={[
          "Ride-Hailing Platforms",
          "Delivery Services",
          "Fleet Management",
          "Vehicle Insurance",
          "Vehicle Finance",
          "Used Car Marketplaces",
          "Parking Solutions",
          "Toll Management"
        ]}
        faqs={[
          {
            question: "What RC details can be verified?",
            answer: "You can verify registration number, owner name, vehicle class, fuel type, registration date, chassis number, engine number, insurance validity, and fitness certificate status."
          },
          {
            question: "Which states are supported?",
            answer: "We support RC and DL verification across all states in India through integration with VAHAN and SARATHI databases."
          },
          {
            question: "Can I verify commercial vehicle permits?",
            answer: "Yes, for commercial vehicles, you can also verify permits, fitness certificates, and tax status along with RC details."
          },
          {
            question: "How accurate is the verification?",
            answer: "All verifications are done against official RTO databases (VAHAN/SARATHI), ensuring 100% accuracy of returned data."
          },
          {
            question: "Is real-time verification available?",
            answer: "Yes, all verifications are performed in real-time with sub-second response times for most queries."
          }
        ]}
      />
    </>
  );
};

export default VehicleVerificationPage;
