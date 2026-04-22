import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ZOHO_SIGNUP_EMBED_URL } from "@/lib/config/zoho";
import { appendTrackingParams } from "@/hooks/use-tracking-params";
import { isBrowser } from "@/lib/ssr-safe";
import { SITE_URL } from "@/lib/config/site";

function buildSrc(website: string, referrername: string) {
  return `${ZOHO_SIGNUP_EMBED_URL}?Website=${encodeURIComponent(website)}&referrername=${encodeURIComponent(referrername)}`;
}

export const ZohoSignupForm = () => {
  const { pathname } = useLocation();
  const referrername = pathname.replace(/^\/+|\/+$/g, ""); // strip leading and trailing slashes

  // Start with SITE_URL (matches SSR output, avoids hydration mismatch)
  const [src, setSrc] = useState(() => buildSrc(SITE_URL + pathname, referrername));

  useEffect(() => {
    if (!isBrowser()) return;
    // By now, useCaptureTrackingParams has run and populated sessionStorage
    const website = appendTrackingParams(window.location.href);
    setSrc(buildSrc(website, referrername));
  }, [pathname, referrername]);

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
