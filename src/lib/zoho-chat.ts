/**
 * Opens the Zoho SalesIQ chat widget reliably,
 * even after the user has closed it previously.
 */
interface ZohoSalesIQ {
  chatwindow?: {
    visible?: (mode: "show") => void;
  };
  chat?: {
    start?: () => void;
  };
}

interface ZohoGlobal {
  salesiq?: ZohoSalesIQ;
}

export function openZohoChat() {
  const zoho = (window as Window & { $zoho?: ZohoGlobal }).$zoho;
  if (!zoho?.salesiq) return;

  // Show the chat window first (works even after close)
  if (zoho.salesiq.chatwindow?.visible) {
    zoho.salesiq.chatwindow.visible("show");
  }
  // Then start a new chat conversation
  if (zoho.salesiq.chat?.start) {
    zoho.salesiq.chat.start();
  }
}
