import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  fileName?: string;
  className?: string;
}

export const CodeBlock = ({ code, language = "javascript", fileName, className }: CodeBlockProps) => {
  return (
    <div className={cn("code-block", className)}>
      <div className="code-header">
        <div className="flex gap-1.5">
          <div className="code-dot bg-destructive/80" />
          <div className="code-dot bg-primary" />
          <div className="code-dot bg-eko-success" />
        </div>
        {fileName && (
          <span className="ml-4 text-xs text-white/50 font-mono">{fileName}</span>
        )}
      </div>
      <div className="p-4 lg:p-6 overflow-x-auto">
        <pre className="text-sm lg:text-base leading-relaxed">
          <code className="text-white/90 font-mono">{code}</code>
        </pre>
      </div>
    </div>
  );
};

export const exampleApiCode = `// Initialize Eko API Client
const eko = new EkoAPI({
  apiKey: process.env.EKO_API_KEY
});

// Verify PAN Card
const verification = await eko.verify.pan({
  panNumber: "ABCDE1234F",
  fullName: "John Doe"
});

console.log(verification.status); // "verified"
console.log(verification.details);`;

export const examplePaymentCode = `// Create DMT Transfer
const transfer = await eko.payments.dmt({
  beneficiaryAccount: "1234567890",
  ifscCode: "HDFC0001234",
  amount: 5000,
  senderMobile: "9876543210"
});

// Check transfer status
const status = await eko.payments.status(
  transfer.transactionId
);`;

export const exampleIntegrationSteps = [
  {
    step: 1,
    title: "Sign Up",
    description: "Create your developer account and access the sandbox environment"
  },
  {
    step: 2,
    title: "Get API Keys",
    description: "Generate your API keys from the developer dashboard"
  },
  {
    step: 3,
    title: "Start Integrating",
    description: "Use our SDKs and comprehensive docs to build your solution"
  }
];
