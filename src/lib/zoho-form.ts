import { z } from "zod";

const ZOHO_ENDPOINT =
  "https://forms.zohopublic.in/ekoindiafinancialservicespvtlt/form/NewEkoinAPISignup/formperma/t7sfVQXMPus-0edXDrlVwvYeOUvLukZFFDUpISXlsnk/htmlRecords/submit";

export const leadFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255, "Name is too long"),
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(255, "Email is too long")
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"),
});

export type LeadFormData = z.infer<typeof leadFormSchema>;

export type LeadFormErrors = Partial<Record<keyof LeadFormData, string>>;

export function validateLeadForm(data: LeadFormData): LeadFormErrors | null {
  const result = leadFormSchema.safeParse(data);
  if (result.success) return null;
  const errors: LeadFormErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof LeadFormData;
    if (!errors[field]) errors[field] = issue.message;
  }
  return errors;
}

interface SubmitOptions {
  referrer?: string;
}

export async function submitToZoho(
  data: LeadFormData,
  options?: SubmitOptions
): Promise<void> {
  const params = new URLSearchParams(window.location.search);

  const formData = new FormData();
  formData.append("SingleLine", data.name.trim());
  formData.append("PhoneNumber_countrycode", "+91");
  formData.append("PhoneNumber_countrycodeval", data.phone.trim());
  formData.append("Email", data.email.trim());

  formData.append("zf_referrer_name", options?.referrer || "");
  formData.append("zf_redirect_url", "");
  formData.append("zc_gad", "");

  formData.append("utm_source", params.get("utm_source") || "");
  formData.append("utm_medium", params.get("utm_medium") || "");
  formData.append("utm_campaign", params.get("utm_campaign") || "");
  formData.append("utm_term", params.get("utm_term") || "");
  formData.append("utm_content", params.get("utm_content") || "");

  // Use hidden iframe approach for reliable cross-origin form submission
  const iframeName = `zoho_submit_${Date.now()}`;
  const iframe = document.createElement("iframe");
  iframe.name = iframeName;
  iframe.style.display = "none";
  document.body.appendChild(iframe);

  const form = document.createElement("form");
  form.method = "POST";
  form.action = ZOHO_ENDPOINT;
  form.target = iframeName;
  form.enctype = "multipart/form-data";
  form.style.display = "none";

  // Append all fields as hidden inputs
  formData.forEach((value, key) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value as string;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();

  // Clean up after submission
  setTimeout(() => {
    form.remove();
    iframe.remove();
  }, 5000);
}
