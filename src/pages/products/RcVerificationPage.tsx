import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { Car, Shield, Zap, CheckCircle, FileText, Users, Calendar, Search } from "lucide-react";

const RcVerificationPage = () => {
  return (
    <>
      <Helmet>
        <title>RC Verification API - Vehicle Registration Check | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Verify vehicle registration certificates instantly with Eko's RC Verification API. Check owner details, insurance status, fitness from VAHAN database." 
        />
        <meta name="keywords" content="RC verification API, vehicle registration API, VAHAN API, vehicle verification, registration certificate API, Eko API" />
        <link rel="canonical" href="https://eko.in/products/rc-verification-api" />
        <meta property="og:title" content="RC Verification API - Vehicle Registration Check | Eko" />
        <meta property="og:description" content="Verify vehicle registration certificates from official VAHAN database." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="RC Verification API"
        description="Verify vehicle registration from VAHAN database"
        heroTitle="RC Verification API"
        heroSubtitle="Verify vehicle registration certificates instantly from the official VAHAN database. Get complete vehicle and owner details for mobility, logistics, and insurance."
        category="verification"
        docsUrl="https://developers.eko.in/docs/rc-verification"
        features={[
          {
            title: "Vehicle Details",
            description: "Get make, model, variant, fuel type, and color information.",
            icon: Car
          },
          {
            title: "Owner Information",
            description: "Verify registered owner name and address.",
            icon: Users
          },
          {
            title: "Insurance Status",
            description: "Check if vehicle has active insurance coverage.",
            icon: Shield
          },
          {
            title: "Fitness Certificate",
            description: "Verify fitness certificate status and validity.",
            icon: CheckCircle
          },
          {
            title: "Registration Validity",
            description: "Check registration date and validity period.",
            icon: Calendar
          },
          {
            title: "Chassis & Engine",
            description: "Verify chassis and engine numbers for authenticity.",
            icon: Search
          }
        ]}
        benefits={[
          {
            title: "Fleet Compliance",
            description: "Ensure all fleet vehicles have valid registration and documents.",
            icon: CheckCircle
          },
          {
            title: "Insurance Verification",
            description: "Verify vehicle details before issuing motor insurance policies.",
            icon: Shield
          },
          {
            title: "Used Car Market",
            description: "Authenticate vehicle history for used car transactions.",
            icon: Car
          },
          {
            title: "Fraud Prevention",
            description: "Detect stolen vehicles and fake registration documents.",
            icon: Search
          },
          {
            title: "Loan Underwriting",
            description: "Verify vehicle details for vehicle finance applications.",
            icon: FileText
          },
          {
            title: "Quick Verification",
            description: "Real-time verification with sub-second response times.",
            icon: Zap
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
            description: "Receive your API credentials."
          },
          {
            step: 3,
            title: "Integrate",
            description: "Add RC verification to your workflow."
          },
          {
            step: 4,
            title: "Test",
            description: "Test with sample registration numbers."
          },
          {
            step: 5,
            title: "Deploy",
            description: "Go live with production credentials."
          }
        ]}
        useCases={[
          "Vehicle Insurance",
          "Vehicle Finance",
          "Used Car Platforms",
          "Fleet Management",
          "Ride-Hailing",
          "Toll Management",
          "Parking Solutions",
          "Traffic Management"
        ]}
        faqs={[
          {
            question: "What details are returned in RC verification?",
            answer: "We return registration number, owner name, owner address, vehicle make/model, fuel type, chassis number, engine number, registration date, insurance validity, fitness certificate status, and more."
          },
          {
            question: "Is data from all states available?",
            answer: "Yes, we have pan-India coverage through VAHAN database integration, covering all states and union territories."
          },
          {
            question: "Can I verify commercial vehicles?",
            answer: "Yes, for commercial vehicles you get additional details like permit type, permit validity, tax status, and fitness certificate details."
          },
          {
            question: "How accurate is the insurance status?",
            answer: "Insurance status is fetched from VAHAN which is updated by insurance companies. It reflects the latest known insurance status as reported to the transport authority."
          },
          {
            question: "Can I detect stolen vehicles?",
            answer: "VAHAN data includes blacklist status. Vehicles reported stolen are flagged in the verification response, helping you avoid such vehicles."
          }
        ]}
      />
    </>
  );
};

export default RcVerificationPage;
