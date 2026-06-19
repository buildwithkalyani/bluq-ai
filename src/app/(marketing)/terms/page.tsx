import type { Metadata } from "next";
import Image from "next/image";
import MobileNav from "../components/MobileNav";

export const metadata: Metadata = {
  title: "Terms of Service · BluQ",
  description: "Terms governing your use of the BluQ platform and services.",
};

const NAV_LINKS = [
  { href: "/",           label: "Home" },
  { href: "/#problem",   label: "Problem" },
  { href: "/#product",   label: "Product" },
  { href: "/#built-for", label: "Who it's for" },
  { href: "/about",      label: "About" },
  { href: "/contact",    label: "Contact us" },
  { href: "/#demo",      label: "Get a Demo →" },
];

const Logo = () => (
  <a href="/" className="n-logo">
    <Image src="/bluq-logo.png" alt="BluQ" width={120} height={32} style={{ height: 32, width: "auto" }} />
  </a>
);

export default function Terms() {
  return (
    <>
      <nav className="n-nav">
        <div className="n-nav-inner">
          <Logo />
          <div className="n-nav-links">
            <a href="/">Home</a>
            <a href="/#problem">Problem</a>
            <a href="/#product">Product</a>
            <a href="/#built-for">Who it&apos;s for</a>
            <a href="/about">About</a>
            <a href="/contact">Contact us</a>
            <a href="/#demo" className="n-nav-cta">Get a Demo →</a>
          </div>
          <MobileNav links={NAV_LINKS} />
        </div>
      </nav>

      <div className="n-wrap" style={{ paddingTop: 120, paddingBottom: 96 }}>
        <div style={{ maxWidth: 760 }}>
          <p style={{ color: "var(--text-3)", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
            Last updated June 18, 2026
          </p>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, lineHeight: 1.15, marginBottom: 32 }}>
            Terms of Service
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: 15, lineHeight: 1.8, marginBottom: 48 }}>
            These Terms of Service govern your access to and use of the services provided by{" "}
            <strong style={{ color: "var(--text)" }}>Bluq Technologies Private Limited</strong> (doing business as{" "}
            <strong style={{ color: "var(--text)" }}>BluQ</strong>), including our web application, APIs, and related
            services (collectively, the &quot;Services&quot;). By creating an account or using the Services, you agree
            to be bound by these Terms. If you do not agree, do not use the Services. Questions? Contact us at{" "}
            <a href="mailto:aishna@bluq.ai" style={{ color: "var(--accent)" }}>aishna@bluq.ai</a> or{" "}
            <a href="mailto:kalyani@bluq.ai" style={{ color: "var(--accent)" }}>kalyani@bluq.ai</a>.
          </p>

          <TermsSection id="toc" title="Table of Contents">
            <ol style={{ color: "var(--accent)", lineHeight: 2.2, paddingLeft: 20 }}>
              {[
                ["#acceptance",     "Acceptance of terms"],
                ["#services",       "Description of services"],
                ["#eligibility",    "Account registration and eligibility"],
                ["#subscription",   "Subscription and payment terms"],
                ["#acceptable-use", "Acceptable use policy"],
                ["#ip",             "Intellectual property rights"],
                ["#customer-data",  "Customer data and privacy"],
                ["#whatsapp",       "WhatsApp integration terms"],
                ["#ai-disclaimer",  "AI-generated content disclaimer"],
                ["#confidentiality","Confidentiality"],
                ["#warranties",     "Disclaimers of warranties"],
                ["#liability",      "Limitation of liability"],
                ["#indemnification","Indemnification"],
                ["#termination",    "Term and termination"],
                ["#governing-law",  "Governing law and jurisdiction"],
                ["#disputes",       "Dispute resolution"],
                ["#general",        "General provisions"],
              ].map(([href, label], i) => (
                <li key={href}>
                  <a href={href} style={{ color: "var(--accent)", textDecoration: "none" }}>
                    {i + 1}. {label}
                  </a>
                </li>
              ))}
            </ol>
          </TermsSection>

          <TermsSection id="acceptance" title="1. Acceptance of Terms">
            <p>
              By accessing or using the Services, you confirm that you have read, understood, and agree to be bound
              by these Terms and our{" "}
              <a href="/privacy" style={{ color: "var(--accent)" }}>Privacy Policy</a>, which is incorporated herein
              by reference. If you are accepting these Terms on behalf of a company or other legal entity, you
              represent and warrant that you have the authority to bind that entity.
            </p>
            <p>
              These Terms constitute a legally binding agreement between you (or the organisation you represent) and
              Bluq Technologies Private Limited, a company incorporated under the laws of India.
            </p>
          </TermsSection>

          <TermsSection id="services" title="2. Description of Services">
            <p>
              BluQ is an AI-powered construction site management platform that provides, among other features:
            </p>
            <ul>
              <li>AI-powered schedule generation, critical path analysis, and delay prediction</li>
              <li>Automated daily progress report (DPR) generation</li>
              <li>WhatsApp-based site check-ins and task tracking for site engineers</li>
              <li>Schedule import from Primavera (.xer), MS Project (.mpp), and Excel (.xlsx) files</li>
              <li>Gantt chart visualisation and project dashboards</li>
              <li>Client-facing shareable reports and audit trails</li>
            </ul>
            <p>
              We reserve the right to modify, suspend, or discontinue any part of the Services at any time with
              reasonable prior notice. We will not be liable to you or any third party for any modification,
              suspension, or discontinuation of the Services.
            </p>
          </TermsSection>

          <TermsSection id="eligibility" title="3. Account Registration and Eligibility">
            <p>
              To use the Services, you must:
            </p>
            <ul>
              <li>Be at least 18 years of age</li>
              <li>Have the legal capacity to enter into a binding contract</li>
              <li>Register with accurate, complete, and current information</li>
              <li>Maintain the security of your account credentials</li>
            </ul>
            <p>
              You are responsible for all activity that occurs under your account. You must notify us immediately at{" "}
              <a href="mailto:aishna@bluq.ai" style={{ color: "var(--accent)" }}>aishna@bluq.ai</a> or{" "}
              <a href="mailto:kalyani@bluq.ai" style={{ color: "var(--accent)" }}>kalyani@bluq.ai</a> if you suspect
              unauthorised access to your account. We are not liable for any loss arising from your failure to keep
              your credentials secure.
            </p>
            <p>
              One account may represent one organisation (&quot;Workspace&quot;). Multiple users within an
              organisation may be added as Workspace members subject to your subscription plan.
            </p>
          </TermsSection>

          <TermsSection id="subscription" title="4. Subscription and Payment Terms">
            <p>
              Access to the Services is provided on a subscription basis. By subscribing, you authorise us to charge
              your chosen payment method on a recurring monthly or annual basis, as selected at the time of
              subscription.
            </p>
            <p>
              <strong>Billing.</strong> Subscription fees are billed in advance at the start of each billing period.
              All fees are non-refundable except as expressly stated in these Terms or required by applicable law.
            </p>
            <p>
              <strong>Price changes.</strong> We reserve the right to change subscription fees. We will give you at
              least 30 days&apos; written notice before any price change takes effect. Continued use of the Services
              after a price change constitutes acceptance of the new fees.
            </p>
            <p>
              <strong>Taxes.</strong> Subscription fees are exclusive of applicable taxes. You are responsible for
              all applicable taxes, including GST, VAT, or other taxes levied in your jurisdiction.
            </p>
            <p>
              <strong>Late payment.</strong> If payment is not received within 7 days of the due date, we reserve the
              right to suspend access to the Services until payment is made in full.
            </p>
            <p>
              <strong>Free trials.</strong> If we offer a free trial, access to paid features will require a valid
              subscription at the end of the trial period. We reserve the right to modify or cancel free trial
              offers at any time.
            </p>
          </TermsSection>

          <TermsSection id="acceptable-use" title="5. Acceptable Use Policy">
            <p>You agree not to use the Services to:</p>
            <ul>
              <li>Violate any applicable law or regulation, including data protection laws</li>
              <li>Upload or transmit malicious code, viruses, or any software designed to disrupt the Services</li>
              <li>Attempt to gain unauthorised access to any part of the Services or related systems</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Services</li>
              <li>Scrape, crawl, or use automated means to extract data from the Services without our written consent</li>
              <li>Resell, sublicense, or otherwise make the Services available to third parties outside your organisation without our written consent</li>
              <li>Use the Services to store or transmit content that is unlawful, defamatory, or infringes third-party rights</li>
              <li>Interfere with or disrupt the integrity or performance of the Services</li>
            </ul>
            <p>
              We reserve the right to suspend or terminate your account immediately if we determine, in our sole
              discretion, that you have violated this Acceptable Use Policy.
            </p>
          </TermsSection>

          <TermsSection id="ip" title="6. Intellectual Property Rights">
            <p>
              <strong>BluQ IP.</strong> All rights, title, and interest in and to the Services, including all
              software, algorithms, user interfaces, documentation, and AI models, remain exclusively with Bluq
              Technologies Private Limited. These Terms do not grant you any ownership rights in the Services.
            </p>
            <p>
              <strong>Licence to use.</strong> Subject to these Terms and payment of applicable fees, we grant you a
              limited, non-exclusive, non-transferable, revocable licence to access and use the Services for your
              internal business purposes during your subscription period.
            </p>
            <p>
              <strong>Customer IP.</strong> You retain all rights to the data, files, schedules, and content you
              upload to the Services (&quot;Customer Data&quot;). You grant us a limited, non-exclusive licence to
              process Customer Data solely to provide the Services to you.
            </p>
            <p>
              <strong>Feedback.</strong> If you provide us with suggestions, ideas, or feedback about the Services,
              you grant us a perpetual, irrevocable, royalty-free licence to use such feedback without restriction or
              compensation to you.
            </p>
          </TermsSection>

          <TermsSection id="customer-data" title="7. Customer Data and Privacy">
            <p>
              <strong>Ownership.</strong> You own all Customer Data you upload or generate through the Services.
              We process Customer Data as a data processor acting on your instructions, as further described in our{" "}
              <a href="/privacy" style={{ color: "var(--accent)" }}>Privacy Policy</a>.
            </p>
            <p>
              <strong>Your responsibilities.</strong> You are solely responsible for ensuring that you have all
              necessary rights and permissions to upload Customer Data to the Services, including any project data,
              schedules, photographs, or employee information. You represent that Customer Data does not violate any
              third-party rights or applicable law.
            </p>
            <p>
              <strong>Data security.</strong> We implement commercially reasonable technical and organisational
              measures to protect Customer Data. However, you acknowledge that no system is completely secure and we
              cannot guarantee absolute security.
            </p>
            <p>
              <strong>Data on termination.</strong> Upon termination of your account, we will retain your Customer
              Data for 90 days to enable data export, after which it will be permanently deleted in accordance with
              our Privacy Policy.
            </p>
            <p>
              <strong>Aggregated data.</strong> We may use anonymised, aggregated, and de-identified data derived
              from your use of the Services to improve our platform, train models, and develop new features. Such
              data will not identify you or your organisation.
            </p>
          </TermsSection>

          <TermsSection id="whatsapp" title="8. WhatsApp Integration Terms">
            <p>
              BluQ uses the WhatsApp Business API operated by Meta Platforms Inc. to facilitate site check-ins and
              automated communications between your organisation and your site engineers.
            </p>
            <p>
              <strong>Your obligations.</strong> You are responsible for:
            </p>
            <ul>
              <li>
                Ensuring that site engineers and other personnel whose phone numbers are registered on the platform
                have consented to receive WhatsApp messages from your organisation via BluQ.
              </li>
              <li>
                Complying with WhatsApp&apos;s Business Policy and Messaging Policy when using the integration.
              </li>
              <li>
                Not using the WhatsApp integration to send unsolicited messages, spam, or content that violates
                applicable law.
              </li>
            </ul>
            <p>
              <strong>Third-party terms.</strong> Use of the WhatsApp integration is also subject to Meta&apos;s
              terms of service and privacy policy. We are not responsible for any interruption, modification, or
              discontinuation of WhatsApp services by Meta.
            </p>
          </TermsSection>

          <TermsSection id="ai-disclaimer" title="9. AI-Generated Content Disclaimer">
            <p>
              The Services include AI-powered features that generate schedules, reports, delay predictions, and
              other outputs based on data you provide (&quot;AI Outputs&quot;).
            </p>
            <p>
              <strong>Advisory only.</strong> AI Outputs are provided for informational and advisory purposes only.
              They do not constitute professional engineering, legal, or project management advice. You are solely
              responsible for evaluating, verifying, and acting on any AI Output. BluQ does not warrant the
              accuracy, completeness, or fitness for purpose of any AI Output.
            </p>
            <p>
              <strong>Financial features.</strong> Where the Services include financial management features (such as
              budget tracking, cost forecasting, or payment scheduling), a distinction applies: data you manually
              enter or import (actual costs, invoices, contract values) constitutes your own records and remains
              your responsibility to verify for accuracy. AI-generated financial forecasts, cost predictions, and
              budget optimisation suggestions derived from that data are advisory only and do not constitute
              financial advice. You should not make binding financial commitments or contractual decisions based
              solely on AI-generated financial outputs without independent verification.
            </p>
            <p>
              <strong>No reliance.</strong> You agree not to make critical project decisions, issue contractual
              notices, or take legal or financial action based solely on AI Outputs without independent verification.
              Any decisions made on the basis of AI Outputs are made at your own risk and judgment.
            </p>
            <p>
              <strong>Third-party AI processing.</strong> AI features are powered in part by Anthropic&apos;s Claude
              models. By using AI features, you acknowledge that relevant data will be transmitted to Anthropic for
              processing in accordance with their privacy policy.
            </p>
          </TermsSection>

          <TermsSection id="confidentiality" title="10. Confidentiality">
            <p>
              Each party may disclose confidential information to the other in connection with the Services.
              &quot;Confidential Information&quot; means any information that is marked as confidential or that a
              reasonable person would understand to be confidential given the nature of the information and the
              circumstances of disclosure.
            </p>
            <p>
              Each party agrees to: (a) hold the other&apos;s Confidential Information in strict confidence using at
              least the same degree of care it uses for its own confidential information (but no less than reasonable
              care); (b) not disclose Confidential Information to third parties without prior written consent; and
              (c) use Confidential Information solely to exercise rights or fulfil obligations under these Terms.
            </p>
            <p>
              These obligations do not apply to information that: (i) is or becomes publicly available through no
              fault of the receiving party; (ii) was known to the receiving party before disclosure; (iii) is
              independently developed by the receiving party without use of Confidential Information; or (iv) must
              be disclosed by law or court order, provided the disclosing party is given reasonable prior notice.
            </p>
          </TermsSection>

          <TermsSection id="warranties" title="11. Disclaimers of Warranties">
            <p>
              THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY
              KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, BLUQ DISCLAIMS
              ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p>
              We do not warrant that: (a) the Services will be uninterrupted, error-free, or secure; (b) any
              defects will be corrected; (c) the Services or the servers that make them available are free of
              viruses or other harmful components; or (d) the results obtained from using the Services will be
              accurate or reliable.
            </p>
          </TermsSection>

          <TermsSection id="liability" title="12. Limitation of Liability">
            <p>
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, BLUQ TECHNOLOGIES PRIVATE LIMITED, ITS DIRECTORS,
              EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
              PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, REVENUE, DATA,
              GOODWILL, OR BUSINESS OPPORTUNITIES, ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR YOUR USE OF
              THE SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p>
              IN NO EVENT WILL OUR TOTAL CUMULATIVE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATED TO
              THESE TERMS OR THE SERVICES EXCEED THE TOTAL SUBSCRIPTION FEES PAID BY YOU TO US IN THE TWELVE (12)
              MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
            </p>
            <p>
              THE LIMITATIONS IN THIS SECTION APPLY REGARDLESS OF THE FORM OF ACTION, WHETHER IN CONTRACT, TORT,
              STRICT LIABILITY, OR OTHERWISE, AND WILL SURVIVE AND APPLY EVEN IF ANY LIMITED REMEDY FAILS OF ITS
              ESSENTIAL PURPOSE.
            </p>
          </TermsSection>

          <TermsSection id="indemnification" title="13. Indemnification">
            <p>
              You agree to indemnify, defend, and hold harmless Bluq Technologies Private Limited and its directors,
              officers, employees, agents, and licensors from and against any and all claims, damages, losses,
              liabilities, costs, and expenses (including reasonable legal fees) arising out of or relating to:
            </p>
            <ul>
              <li>Your use of or inability to use the Services</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any applicable law or regulation</li>
              <li>Any Customer Data you upload or transmit through the Services</li>
              <li>Your use of the WhatsApp integration, including failure to obtain proper consent from site personnel</li>
              <li>Any decisions made in reliance on AI Outputs generated by the Services</li>
            </ul>
          </TermsSection>

          <TermsSection id="termination" title="14. Term and Termination">
            <p>
              These Terms commence on the date you first access the Services and continue for the duration of your
              subscription unless terminated earlier in accordance with this section.
            </p>
            <p>
              <strong>Termination by you.</strong> You may cancel your subscription at any time through your account
              settings or by contacting us. Cancellation takes effect at the end of the current billing period. No
              refunds are issued for the remainder of a prepaid billing period, except where required by applicable
              law.
            </p>
            <p>
              <strong>Termination by us.</strong> We may suspend or terminate your access to the Services
              immediately and without prior notice if: (a) you breach these Terms and fail to remedy the breach
              within 7 days of written notice; (b) you fail to make payment; (c) we are required to do so by law;
              or (d) we determine that continued access poses a security or legal risk.
            </p>
            <p>
              <strong>Effect of termination.</strong> Upon termination, your licence to use the Services ceases
              immediately. Sections 6, 7, 9, 10, 11, 12, 13, and 15 of these Terms survive termination. We will
              retain your Customer Data for 90 days following termination to enable data export, after which it
              will be permanently deleted.
            </p>
          </TermsSection>

          <TermsSection id="governing-law" title="15. Governing Law and Jurisdiction">
            <p>
              These Terms are governed by and construed in accordance with the laws of India, without regard to its
              conflict of law principles. The United Nations Convention on Contracts for the International Sale of
              Goods does not apply to these Terms.
            </p>
            <p>
              Subject to the dispute resolution provisions below, you irrevocably submit to the exclusive
              jurisdiction of the courts located in <strong style={{ color: "var(--text)" }}>India</strong> for
              the resolution of any dispute arising out of or in connection with these Terms or the Services.
            </p>
            <p>
              <strong>Pan-India customers.</strong> Customers accessing the Services from any state or union
              territory in India are subject to Indian law and the exclusive jurisdiction of courts in India.
            </p>
            <p>
              <strong>Future international expansion.</strong> If you are accessing the Services from a jurisdiction
              outside India, the following applies:
            </p>
            <ul>
              <li>
                These Terms remain governed by Indian law to the fullest extent permitted by your local law.
              </li>
              <li>
                Where mandatory local consumer or data protection laws in your jurisdiction cannot be contractually
                waived (for example, EU General Data Protection Regulation or UK GDPR), those mandatory protections
                apply to you in addition to these Terms. Only the specific clause affected by mandatory local law
                will be modified to the minimum extent necessary; all other provisions of these Terms remain in
                full force.
              </li>
              <li>
                Disputes will still be resolved by arbitration seated in India, unless local mandatory law
                requires otherwise.
              </li>
            </ul>
            <p>
              <strong>Severability of choice of law.</strong> If a court of competent jurisdiction determines that
              Indian law cannot govern a specific clause of these Terms in your jurisdiction, that clause alone
              will be governed by the applicable local law. The remainder of these Terms will continue to be
              governed by Indian law.
            </p>
          </TermsSection>

          <TermsSection id="disputes" title="16. Dispute Resolution">
            <p>
              <strong>Informal resolution.</strong> Before initiating any formal proceedings, you agree to first
              contact us at{" "}
              <a href="mailto:aishna@bluq.ai" style={{ color: "var(--accent)" }}>aishna@bluq.ai</a> or{" "}
              <a href="mailto:kalyani@bluq.ai" style={{ color: "var(--accent)" }}>kalyani@bluq.ai</a> and attempt to
              resolve the dispute informally. We will make good-faith efforts to resolve any complaint within 30
              days.
            </p>
            <p>
              <strong>Arbitration.</strong> If informal resolution fails, any dispute, controversy, or claim arising
              out of or relating to these Terms or the Services, including questions of validity, breach, or
              termination, will be finally settled by binding arbitration in accordance with the Arbitration and
              Conciliation Act, 1996 (India). The arbitration will be conducted in English by a sole arbitrator
              mutually agreed upon by both parties, or, if no agreement is reached within 15 days, appointed by the
              Indian Council of Arbitration. The seat of arbitration will be India.
            </p>
            <p>
              <strong>Exceptions.</strong> Either party may seek injunctive or other equitable relief in a court of
              competent jurisdiction to prevent actual or threatened infringement of intellectual property rights or
              breach of confidentiality obligations.
            </p>
          </TermsSection>

          <TermsSection id="general" title="17. General Provisions">
            <p>
              <strong>Entire agreement.</strong> These Terms, together with our Privacy Policy and any order forms
              or addenda, constitute the entire agreement between you and BluQ regarding the Services and supersede
              all prior agreements and understandings.
            </p>
            <p>
              <strong>Modifications.</strong> We reserve the right to modify these Terms at any time. We will
              provide at least 14 days&apos; written notice before material changes take effect. Continued use of
              the Services after changes take effect constitutes acceptance of the revised Terms.
            </p>
            <p>
              <strong>Waiver.</strong> Failure by either party to enforce any provision of these Terms will not
              constitute a waiver of future enforcement of that provision or any other provision.
            </p>
            <p>
              <strong>Severability.</strong> If any provision of these Terms is found to be unenforceable, that
              provision will be modified to the minimum extent necessary to make it enforceable, and the remaining
              provisions will continue in full force and effect.
            </p>
            <p>
              <strong>Assignment.</strong> You may not assign or transfer your rights or obligations under these
              Terms without our prior written consent. We may assign these Terms in connection with a merger,
              acquisition, or sale of substantially all of our assets, with notice to you.
            </p>
            <p>
              <strong>Force majeure.</strong> Neither party will be liable for any failure or delay in performance
              resulting from causes beyond their reasonable control, including natural disasters, acts of government,
              internet outages, or third-party service failures (including WhatsApp or cloud infrastructure
              outages).
            </p>
            <p>
              <strong>Notices.</strong> All notices under these Terms must be in writing and sent to{" "}
              <a href="mailto:aishna@bluq.ai" style={{ color: "var(--accent)" }}>aishna@bluq.ai</a> or{" "}
              <a href="mailto:kalyani@bluq.ai" style={{ color: "var(--accent)" }}>kalyani@bluq.ai</a> or to the
              registered address of Bluq Technologies Private Limited, India.
            </p>
          </TermsSection>
        </div>
      </div>

      <footer className="n-footer">
        <div className="n-wrap">
          <div className="n-footer-grid">
            <div className="n-footer-brand">
              <Logo />
              <p className="n-footer-tagline">The AI-powered construction intelligence platform. Prevent delays before they happen.</p>
            </div>
            <div className="n-footer-col">
              <h4>Product</h4>
              <ul>
                <li><a href="/#product">Daily Task Tracking</a></li>
                <li><a href="/#product">Gantt &amp; Critical Path</a></li>
                <li><a href="/#product">AI Delay Analytics</a></li>
                <li><a href="/#product">Schedule Import</a></li>
                <li><a href="/#product">WhatsApp Bot</a></li>
              </ul>
            </div>
            <div className="n-footer-col">
              <h4>Built for</h4>
              <ul>
                <li><a href="/#built-for">PMC Firms</a></li>
                <li><a href="/#built-for">EPC &amp; Contractors</a></li>
                <li><a href="/#built-for">Developers</a></li>
              </ul>
            </div>
            <div className="n-footer-col">
              <h4>Company</h4>
              <ul>
                <li><a href="/about">About</a></li>
                <li><a href="/#demo">Book a Demo</a></li>
                <li><a href="/contact">Contact</a></li>
                <li><a href="/privacy">Privacy Policy</a></li>
                <li><a href="/terms">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="n-footer-bottom">
            <span className="n-footer-copy">© 2026 BluQ Technologies. Building in public.</span>
            <div className="n-footer-legal">
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="/contact">Support</a>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        .tos-h3 {
          font-size: 1rem;
          font-weight: 700;
          color: #fff;
          margin: 28px 0 10px;
        }
      `}</style>
    </>
  );
}

function TermsSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      style={{
        borderTop: "1px solid var(--border)",
        paddingTop: 40,
        marginBottom: 48,
      }}
    >
      <h2
        style={{
          fontSize: "1.2rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--text)",
          marginBottom: 20,
        }}
      >
        {title}
      </h2>
      <div
        style={{
          color: "var(--text-2)",
          fontSize: 15,
          lineHeight: 1.85,
        }}
      >
        {children}
      </div>
    </section>
  );
}
