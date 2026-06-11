/**
 * Opens the Zoho SalesIQ chat widget reliably,
 * even after the user has closed it previously.
 */
import {
  getCalculatorContext,
  getStoredTrackingParams,
} from "@/hooks/use-tracking-params";

interface ZohoSalesIQ {
  chatwindow?: {
    visible?: (mode: "show") => void;
  };
  chat?: {
    start?: () => void;
  };
  visitor?: {
    info?: (data: Record<string, string>) => void;
  };
}

interface ZohoGlobal {
  salesiq?: ZohoSalesIQ;
}

/**
 * Pushes lead context (ad/UTM attribution + pricing-calculator selection)
 * to SalesIQ as visitor info so chat-created leads carry it even when the
 * current page URL doesn't. Best-effort — never blocks opening the chat.
 */
function pushVisitorInfo(salesiq: ZohoSalesIQ) {
  try {
    const calcSelection = getCalculatorContext();
    const info: Record<string, string> = {
      ...getStoredTrackingParams(),
      ...(calcSelection ? { apis_interested: calcSelection } : {}),
    };
    if (Object.keys(info).length > 0) {
      salesiq.visitor?.info?.(info);
    }
  } catch {
    // Widget API shape changed or unavailable — ignore
  }
}

export function openZohoChat() {
  const zoho = (window as Window & { $zoho?: ZohoGlobal }).$zoho;
  if (!zoho?.salesiq) return;

  pushVisitorInfo(zoho.salesiq);

  // Show the chat window first (works even after close)
  if (zoho.salesiq.chatwindow?.visible) {
    zoho.salesiq.chatwindow.visible("show");
  }
  // Then start a new chat conversation
  if (zoho.salesiq.chat?.start) {
    zoho.salesiq.chat.start();
  }
}
