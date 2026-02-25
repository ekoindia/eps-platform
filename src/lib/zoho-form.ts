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
    .max(255, "Email is too long")
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address"),
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

  await fetch(ZOHO_ENDPOINT, {
    method: "POST",
    body: formData,
    mode: "no-cors",
  });
}
