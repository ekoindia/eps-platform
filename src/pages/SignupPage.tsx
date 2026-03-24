import { Helmet } from "react-helmet-async";
import { CheckCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ZOHO_SIGNUP_EMBED_URL } from "@/lib/config/zoho";

const signupBenefits = [
  "Sandbox access in minutes",
  "Dedicated integration support",
  "Comprehensive documentation",
  "99.9% uptime guarantee",
];

const SignupPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Signup | Eko</title>
        <meta
          name="description"
          content="Get access to Eko Platform Services by submitting the signup form."
        />
      </Helmet>

      <Header />

      <main className="pt-24 lg:pt-28">
        <section className="relative overflow-hidden bg-white py-14 md:py-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-eko-gold/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-eko-navy/5 rounded-full blur-3xl" />

          <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-5 leading-tight">
                  Get Access to Eko Platform Services
                </h1>
                <p className="text-muted-foreground text-lg mb-7 leading-relaxed max-w-xl">
                  Sign up now and start integrating in minutes. Our team will help you go live quickly.
                </p>

                <ul className="space-y-3.5">
                  {signupBenefits.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-foreground/80 text-lg">
                      <CheckCircle className="w-5 h-5 text-eko-gold shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative">
                <div className="absolute -inset-3 bg-eko-gold/10 rounded-2xl blur-2xl" />

                <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
                  <div className="bg-eko-navy px-6 py-4 border-b border-white/10">
                    <h2 className="text-lg font-bold text-white">Get Platform Access</h2>
                    <p className="text-white/70 text-sm">Get started in 10 minutes</p>
                  </div>

                  <div className="p-2">
                    <iframe
                      aria-label="New Eko.in API Signup"
                      frameBorder="0"
                      allow="geolocation;"
                      style={{ height: "500px", width: "100%", border: "none" }}
                      src={ZOHO_SIGNUP_EMBED_URL}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default SignupPage;
