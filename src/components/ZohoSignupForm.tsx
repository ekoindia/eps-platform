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
  const referrername = pathname.replace(/^\/+|\/+$/g, "");

  const [src, setSrc] = useState(() => buildSrc(SITE_URL + pathname, referrername));

  useEffect(() => {
    if (!isBrowser()) return;
    const website = appendTrackingParams(window.location.href);
    setSrc(buildSrc(website, referrername));
  }, [pathname, referrername]);

  return (
    <div style={{ minHeight: "500px", width: "100%" }}>
      <iframe
        aria-label="Eko EPS Signup Form"
        frameBorder="0"
        loading="lazy"
        style={{ height: "500px", width: "100%", border: "none" }}
        src={src}
      />
    </div>
  );
};
