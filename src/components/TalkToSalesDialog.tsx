import { useState } from "react";
import { openZohoChat } from "@/lib/zoho-form";
import { ZohoSignupForm } from "@/components/ZohoSignupForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Phone, MessageCircle, FileText, ArrowRight } from "lucide-react";
import { SALES_MOBILE } from "@/lib/config/site";
import { formatMobile } from "@/lib/utils";

interface TalkToSalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TalkToSalesDialog = ({ open, onOpenChange }: TalkToSalesDialogProps) => {
  const [showForm, setShowForm] = useState(false);

  const handleClose = (val: boolean) => {
    onOpenChange(val);
    if (!val) setShowForm(false);
  };

  const handleOpenChatbot = () => {
    handleClose(false);
    openZohoChat();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {!showForm ? (
          <>
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="text-xl font-bold">Talk to Sales</DialogTitle>
              <DialogDescription>Choose how you'd like to connect with our team.</DialogDescription>
            </DialogHeader>
            <div className="p-6 pt-2 space-y-3">
              {/* Call Option */}
              <a
                href={`tel:+91${SALES_MOBILE}`}
                className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-eko-gold/50 hover:bg-eko-gold/5 transition-all group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                  <Phone className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Call Us</p>
                  <p className="text-sm text-muted-foreground">{formatMobile(SALES_MOBILE)}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-eko-gold group-hover:translate-x-1 transition-all" />
              </a>

              {/* Chatbot Option */}
              <button
                onClick={handleOpenChatbot}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-eko-gold/50 hover:bg-eko-gold/5 transition-all group cursor-pointer text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Chat with Us</p>
                  <p className="text-sm text-muted-foreground">Get instant help via live chat</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-eko-gold group-hover:translate-x-1 transition-all" />
              </button>

              {/* Leave Contact Details Option */}
              <button
                onClick={() => setShowForm(true)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-eko-gold/50 hover:bg-eko-gold/5 transition-all group cursor-pointer text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Leave Your Details</p>
                  <p className="text-sm text-muted-foreground">We'll call you back within 24 hours</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-eko-gold group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="text-xl font-bold">Leave Your Details</DialogTitle>
              <DialogDescription>Fill in your details and our team will reach out within 24 hours.</DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-6">
              <ZohoSignupForm />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
