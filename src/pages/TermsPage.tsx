import { Link } from "react-router-dom";
import LegalPageLayout from "@/components/LegalPageLayout";

const TermsPage = () => {
  return (
    <LegalPageLayout
      title="Terms & Conditions"
      description="Read Eko's terms and conditions governing the use of our payment and verification API services."
    >
      <p>
        The following terms and conditions ("<strong>T&C's</strong>") constitute a binding agreement between you ("<strong>You</strong>") and Eko Bharat Ventures Private Limited (formerly known as Eko India Financial Services Private Limited) ("<strong>Eko</strong>"). By using <strong>Eko</strong>'s services, you agree to be bound by these <strong>T&C's</strong>.
      </p>

      <h3>1. Working Procedure</h3>
      <p>Eko provides its services in the following manner:</p>
      <ul>
        <li><strong>First Step:</strong> Eko becomes the Business Correspondent (BC) of Banks / FIs.</li>
        <li><strong>Second Step:</strong> Eko appoints BC agents (typically a retail merchant) for doing Domestic Money Transfer business. The BC Agent deposits initial capital in Eko's Bank account to start the business. Eko provides equivalent Trading balance in the form of 'E-money' to retailer on Eko's portal.</li>
        <li><strong>Third Step:</strong> Eko appoints Distributors, who use their field agents for collecting cash from retailer's outlets.</li>
      </ul>

      <h3>2. KYC Compliance</h3>
      <p>
        The use of Eko's services will be allowed in adherence to RBI KYC policy. For compliance to RBI KYC policy, Eko shall collect, verify and securely maintain your personal identification details before any Services can be delivered.
      </p>

      <h3>3. Registration Data</h3>
      <p>
        You agree that if you provide any information which is false, inaccurate, incomplete or there are otherwise reasonable grounds to suspect that such information is suspicious, inaccurate, or not in accordance with these T&C's, Eko shall have the right to cancel / not effectuate the transaction.
      </p>

      <h3>4. Disclaimer of Warranties</h3>
      <ol>
        <li>Eko has executed Business Correspondent Agreements with various Banks and FIs in order to provide its services. Eko is not responsible for the failure of any transaction where such failure has resulted because of the fault of any such Bank or FI.</li>
        <li>Eko shall be responsible for addressing all customer service aspects related to any transaction being affected by using its services.</li>
        <li>Eko is responsible for all acts of omission or commission of its authorized / designated agents, including safety and security aspects.</li>
      </ol>

      <h3>5. Indemnity</h3>
      <ol>
        <li>You agree to indemnify, save, and hold Eko, its affiliates, contractors, employees, officers, directors, agents and its third-party suppliers, licensors, and partners harmless from any and all claims, losses, damages, and liabilities, costs and expenses, including without limitation legal fees and expenses.</li>
        <li>Eko reserves the right, at your expense, to assume the exclusive defense and control of any matter for which you are required to indemnify Eko.</li>
      </ol>

      <h3>6. Limitation of Liability</h3>
      <p>
        The maximum aggregate liability of Eko shall be limited to the amount of the transaction sought to be affected by you.
      </p>

      <h3>7. Force Majeure</h3>
      <p>
        Eko shall not be liable for failure or delay in performing its obligations under these T&C's, if such failure or delay is due to circumstances beyond reasonable control, including, without limitation, acts of any governmental body, lock-downs, pandemics, epidemics, war, insurrection, sabotage, embargo, fire, flood, strike or other labor disturbance, interruption of or delay in transportation, or failure of third party software.
      </p>

      <h3>8. Governing Law and Jurisdiction</h3>
      <p>
        These T&C's shall be interpreted and construed according to and governed by the laws of India. All disputes arising under this Agreement are subjected to the exclusive jurisdiction of courts at Gurugram, Haryana, India.
      </p>

      <h3>9. Entire Agreement</h3>
      <p>
        These T&C's (including all such conditions and policies that are incorporated herein by reference) set forth the entire understanding and agreement between you and Eko.
      </p>
      <ul>
        <li>Customer Grievance link: <Link to="/grievance" className="text-eko-gold hover:underline">Grievance Page</Link></li>
      </ul>

      <h3>10. Grievance and Customer Support</h3>
      <p>You have the right to register your complaint if you are not satisfied with the services of Eko.</p>
      <p>You can lodge a complaint by sending email to <a href="mailto:cs@eko.co.in">cs@eko.co.in</a></p>
      <ul>
        <li><strong>Escalation Level 2:</strong> Grievance Officer: Mr. Abhinav Sinha — <a href="mailto:grievance@eko.co.in">grievance@eko.co.in</a></li>
        <li><strong>Escalation Level 3:</strong> Nodal Officer: Mr. Abhinav Sinha — <a href="mailto:nodaldesk@eko.co.in">nodaldesk@eko.co.in</a></li>
      </ul>
      <p>
        On receiving the escalation, the complaint will be acknowledged within twenty four (24) hours. Post acknowledgement, resolution will be provided up to a maximum of seven (7) days. For details, checkout the <Link to="/grievance" className="text-eko-gold hover:underline">Customer Grievance page</Link>.
      </p>
    </LegalPageLayout>
  );
};

export default TermsPage;
