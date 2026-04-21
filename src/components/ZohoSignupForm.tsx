import { useLocation } from "react-router-dom";
import { ZOHO_SIGNUP_EMBED_URL } from "@/lib/config/zoho";
import { appendTrackingParams } from "@/hooks/use-tracking-params";
import { safeLocationHref } from "@/lib/ssr-safe";

export const ZohoSignupForm = () => {
  const { pathname } = useLocation();
  const referrername = pathname.replace(/^\/+|\/+$/g, ""); // strip leading and trailing slashes
  const website = appendTrackingParams(safeLocationHref());

  const src = `${ZOHO_SIGNUP_EMBED_URL}?Website=${encodeURIComponent(website)}&referrername=${encodeURIComponent(referrername)}`;

  return (
    <iframe
      aria-label="Eko EPS Signup Form"
      frameBorder="0"
      allow="geolocation;"
      style={{ height: "500px", width: "100%", border: "none" }}
      src={src}
    />
  );
};
