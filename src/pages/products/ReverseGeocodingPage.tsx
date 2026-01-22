import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { MapPin, Shield, Zap, CheckCircle, Navigation, Map, Database, Globe } from "lucide-react";

const ReverseGeocodingPage = () => {
  return (
    <>
      <Helmet>
        <title>Reverse Geocoding API - Address from Coordinates | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Convert GPS coordinates to addresses with Eko's Reverse Geocoding API. Get accurate Indian addresses, pincodes, and location details for logistics and fintech." 
        />
        <meta name="keywords" content="reverse geocoding API, GPS to address API, location API, coordinates to address, pincode API, Eko API" />
        <link rel="canonical" href="https://eko.in/products/reverse-geocoding-api" />
        <meta property="og:title" content="Reverse Geocoding API - Address from Coordinates | Eko" />
        <meta property="og:description" content="Convert GPS coordinates to accurate Indian addresses with pincode details." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="Reverse Geocoding API"
        description="Convert GPS coordinates to addresses"
        heroTitle="Reverse Geocoding API"
        heroSubtitle="Convert latitude and longitude coordinates to accurate Indian addresses. Get complete address details including pincode, district, and state for any location."
        category="verification"
        docsUrl="https://developers.eko.in/docs/reverse-geocoding"
        features={[
          {
            title: "Accurate Addresses",
            description: "Get precise address details from GPS coordinates.",
            icon: MapPin
          },
          {
            title: "Complete Details",
            description: "Receive area, city, district, state, and pincode.",
            icon: Map
          },
          {
            title: "India-focused",
            description: "Optimized for Indian addresses with local area names.",
            icon: Globe
          },
          {
            title: "Fast Response",
            description: "Sub-second response times for real-time applications.",
            icon: Zap
          },
          {
            title: "High Coverage",
            description: "Comprehensive coverage across all Indian states and territories.",
            icon: Navigation
          },
          {
            title: "Batch Processing",
            description: "Process multiple coordinates in a single request.",
            icon: Database
          }
        ]}
        benefits={[
          {
            title: "Auto-fill Addresses",
            description: "Pre-fill customer address from GPS for faster onboarding.",
            icon: Zap
          },
          {
            title: "Delivery Optimization",
            description: "Get accurate delivery addresses from driver locations.",
            icon: Navigation
          },
          {
            title: "Fraud Detection",
            description: "Verify customer location claims during KYC.",
            icon: Shield
          },
          {
            title: "Field Force Tracking",
            description: "Log accurate locations for field agent activities.",
            icon: MapPin
          },
          {
            title: "Serviceability Check",
            description: "Determine service availability based on customer location.",
            icon: CheckCircle
          },
          {
            title: "Analytics & Reports",
            description: "Enrich location data for better business insights.",
            icon: Map
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
            title: "Get API Keys",
            description: "Receive your API credentials."
          },
          {
            step: 3,
            title: "Integrate",
            description: "Pass latitude and longitude to our API."
          },
          {
            step: 4,
            title: "Test",
            description: "Test with various coordinates across India."
          },
          {
            step: 5,
            title: "Deploy",
            description: "Go live with production credentials."
          }
        ]}
        useCases={[
          "Customer Onboarding",
          "Delivery Apps",
          "Logistics & Fleet",
          "Insurance Claims",
          "Field Agent Apps",
          "Lending Platforms",
          "Real Estate",
          "Hyperlocal Services"
        ]}
        faqs={[
          {
            question: "How accurate is the address returned?",
            answer: "Accuracy depends on GPS precision. With standard smartphone GPS (10-20m accuracy), we return the correct locality, city, and pincode. For street-level accuracy, higher precision coordinates are needed."
          },
          {
            question: "What address components are returned?",
            answer: "We return formatted address, area/locality, city, district, state, pincode, and country. Components are structured for easy parsing."
          },
          {
            question: "Is the entire India covered?",
            answer: "Yes, we cover all states and union territories including remote areas. Urban areas have higher detail compared to rural/forest areas."
          },
          {
            question: "Can I use this for address verification?",
            answer: "Yes, you can cross-check customer-provided addresses against GPS-derived addresses as part of fraud prevention during KYC."
          },
          {
            question: "What is the rate limit?",
            answer: "Rate limits depend on your plan. Standard plans allow up to 100 requests per second. Contact us for higher throughput requirements."
          }
        ]}
      />
    </>
  );
};

export default ReverseGeocodingPage;
