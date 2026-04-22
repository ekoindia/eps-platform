import { useState, useEffect, useRef } from "react";
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
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isBrowser()) return;
    const website = appendTrackingParams(window.location.href);
    setSrc(buildSrc(website, referrername));
  }, [pathname, referrername]);

  // Defer iframe loading until the container is near the viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ minHeight: "500px", width: "100%" }}>
      {isVisible && (
        <iframe
          aria-label="Eko EPS Signup Form"
          frameBorder="0"
          style={{ height: "500px", width: "100%", border: "none" }}
          src={src}
        />
      )}
    </div>
  );
};
