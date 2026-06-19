import type { Metadata } from "next";
import Image from "next/image";
import MobileNav from "../components/MobileNav";

export const metadata: Metadata = {
  title: "Privacy Policy · BluQ",
  description: "How Bluq Technologies collects, uses, and protects your personal information.",
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

export default function Privacy() {
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
            Privacy Policy
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: 15, lineHeight: 1.8, marginBottom: 48 }}>
            This Privacy Notice for <strong style={{ color: "var(--text)" }}>Bluq Technologies Private Limited</strong> (doing
            business as <strong style={{ color: "var(--text)" }}>Bluq</strong>) describes how and why we might access,
            collect, store, use, and/or share your personal information when you use our services, including when you visit{" "}
            <a href="https://bluq.ai/" style={{ color: "var(--accent)" }}>https://bluq.ai/</a> or use BluQ, our
            AI-powered construction site management platform. This notice is governed by and complies with the{" "}
            <strong style={{ color: "var(--text)" }}>Digital Personal Data Protection Act, 2023 (India)</strong> and
            other applicable data protection laws. If you have questions or concerns, please contact us at{" "}
            <a href="mailto:aishna@bluq.ai" style={{ color: "var(--accent)" }}>aishna@bluq.ai</a> or{" "}
            <a href="mailto:kalyani@bluq.ai" style={{ color: "var(--accent)" }}>kalyani@bluq.ai</a>.
          </p>

          <PolicySection id="toc" title="Table of Contents">
            <ol style={{ color: "var(--accent)", lineHeight: 2.2, paddingLeft: 20 }}>
              {[
                ["#infocollect", "What information do we collect?"],
                ["#infouse", "How do we process your information?"],
                ["#whoshare", "When and with whom do we share your personal information?"],
                ["#cookies", "Do we use cookies and other tracking technologies?"],
                ["#ai", "Do we offer artificial intelligence-based products?"],
                ["#whatsapp", "How do we handle WhatsApp data?"],
                ["#sociallogins", "How do we handle your social logins?"],
                ["#inforetain", "How long do we keep your information?"],
                ["#infosafe", "How do we keep your information safe?"],
                ["#infominors", "Do we collect information from minors?"],
                ["#privacyrights", "What are your privacy rights?"],
                ["#DNT", "Controls for do-not-track features"],
                ["#dpdpa", "India DPDPA compliance and data breach notification"],
                ["#policyupdates", "Do we make updates to this notice?"],
                ["#contact", "How can you contact us about this notice?"],
                ["#request", "How can you review, update, or delete the data we collect from you?"],
              ].map(([href, label], i) => (
                <li key={href}>
                  <a href={href} style={{ color: "var(--accent)", textDecoration: "none" }}>
                    {i + 1}. {label}
                  </a>
                </li>
              ))}
            </ol>
          </PolicySection>

          <PolicySection id="infocollect" title="1. What Information Do We Collect?">
            <h3 className="pp-h3">Personal information you disclose to us</h3>
            <p><em>We collect personal information that you provide to us.</em></p>
            <p>
              We collect personal information that you voluntarily provide to us when you register on the Services,
              express an interest in obtaining information about us or our products and Services, when you participate
              in activities on the Services, or otherwise when you contact us.
            </p>
            <p><strong>Personal Information Provided by You</strong> may include:</p>
            <ul>
              <li>Names</li>
              <li>Phone numbers</li>
              <li>Email addresses</li>
              <li>Project addresses and site location information</li>
            </ul>
            <p>
              <strong>Sensitive Information.</strong> We do not process sensitive personal information.
            </p>
            <p>
              <strong>Social Media Login Data.</strong> We may provide you with the option to register using your
              existing social media account details. If you choose to register in this way, we will collect certain
              profile information from the social media provider, as described in section 7 below.
            </p>
            <p>
              All personal information that you provide to us must be true, complete, and accurate, and you must
              notify us of any changes to such personal information.
            </p>

            <h3 className="pp-h3">Information automatically collected</h3>
            <p>
              <em>
                Some information, including your Internet Protocol (IP) address and browser and device characteristics,
                is collected automatically when you visit our Services.
              </em>
            </p>
            <p>
              We automatically collect certain information when you visit, use, or navigate the Services. This
              information does not reveal your specific identity but may include device and usage information, such as
              your IP address, browser and device characteristics, operating system, language preferences, referring
              URLs, device name, country, location, and information about how and when you use our Services.
            </p>
            <p>Like many businesses, we also collect information through cookies and similar technologies.</p>
            <p>The information we collect includes:</p>
            <ul>
              <li>
                <em>Log and Usage Data.</em> Service-related, diagnostic, usage, and performance information our
                servers automatically collect, including your IP address, device information, browser type, pages and
                files viewed, searches, and other actions you take within the Services.
              </li>
            </ul>
          </PolicySection>

          <PolicySection id="infouse" title="2. How Do We Process Your Information?">
            <p>
              <em>
                We process your information to provide, improve, and administer our Services, communicate with you,
                for security and fraud prevention, and to comply with applicable law. We may also process your
                information for other purposes with your consent.
              </em>
            </p>
            <p>We process your personal information for a variety of reasons, including:</p>
            <ul>
              <li>
                <strong>To facilitate account creation and authentication:</strong> so you can create and log in to
                your account and keep your account in working order.
              </li>
              <li>
                <strong>To deliver and facilitate services:</strong> to provide you with the requested service.
              </li>
              <li>
                <strong>To respond to user inquiries and offer support:</strong> to respond to your inquiries and
                resolve any potential issues you might have with the requested service.
              </li>
              <li>
                <strong>To send administrative information:</strong> to keep you informed about changes to our terms,
                conditions, and policies.
              </li>
              <li>
                <strong>To fulfil and manage your service requests:</strong> to process your requests and keep you
                updated on their status.
              </li>
              <li>
                <strong>To protect an individual&apos;s vital interests:</strong> to prevent harm where necessary.
              </li>
            </ul>
          </PolicySection>

          <PolicySection id="whoshare" title="3. When and With Whom Do We Share Your Personal Information?">
            <p>
              <em>
                We may share information in specific situations described in this section and/or with the following
                third parties.
              </em>
            </p>
            <p>We may need to share your personal information in the following situations:</p>
            <ul>
              <li>
                <strong>Business Transfers.</strong> We may share or transfer your information in connection with, or
                during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a
                portion of our business to another company.
              </li>
              <li>
                <strong>Service Providers and Subprocessors.</strong> We share your information with the following
                categories of third-party vendors and service providers who process data on our behalf:
                <ul style={{ marginTop: 10, marginBottom: 4 }}>
                  <li><strong>Cloud infrastructure:</strong> Supabase (database), Railway (backend hosting), Upstash (caching and queuing)</li>
                  <li><strong>AI processing:</strong> Anthropic (Claude AI models for schedule generation, report summarisation, and delay analysis)</li>
                  <li><strong>Communications:</strong> Meta Platforms (WhatsApp Business API for site check-ins and automated updates)</li>
                  <li><strong>Frontend hosting:</strong> Vercel (web application delivery)</li>
                </ul>
                Each subprocessor is contractually required to maintain appropriate data security standards and to
                process your information only as instructed by us.
              </li>
            </ul>
          </PolicySection>

          <PolicySection id="cookies" title="4. Do We Use Cookies and Other Tracking Technologies?">
            <p>
              <em>
                We may use cookies and other tracking technologies to collect and store your information.
              </em>
            </p>
            <p>
              We may use cookies and similar tracking technologies (such as web beacons and pixels) to gather
              information when you interact with our Services. These technologies help us maintain the security of our
              Services and your account, prevent crashes, fix bugs, save your preferences, and assist with basic site
              functions.
            </p>
            <p>
              You can set your browser to refuse all or some browser cookies, or to alert you when cookies are being
              sent. However, if you refuse cookies, some parts of the Services may not function properly.
            </p>
          </PolicySection>

          <PolicySection id="ai" title="5. Do We Offer Artificial Intelligence-Based Products?">
            <p>
              <em>We offer products, features, and tools powered by artificial intelligence and machine learning technologies.</em>
            </p>
            <p>
              As part of our Services, we offer artificial intelligence (AI)-based features, including AI-powered
              schedule generation, delay prediction, and automated daily progress report generation. These features
              process construction project data and site updates you provide to us.
            </p>
            <p>
              We use Anthropic&apos;s Claude to power these features. Data you submit to our AI-powered features may
              be processed by Anthropic subject to their privacy policy. We limit the data shared with Anthropic to
              what is strictly necessary to deliver the requested feature, and we do not share personally identifiable
              information beyond what is required for the specific task.
            </p>
          </PolicySection>

          <PolicySection id="whatsapp" title="6. How Do We Handle WhatsApp Data?">
            <p>
              <em>
                Site engineers submit daily updates via WhatsApp. We process these messages to power core platform
                features.
              </em>
            </p>
            <p>
              BluQ uses the WhatsApp Business API (operated by Meta Platforms) to receive daily site updates from
              engineers. When a site engineer sends a WhatsApp message to a BluQ-connected number, we receive and
              process the message content, including any text, photos, or attachments shared.
            </p>
            <p>
              These messages may contain information about third parties, including workers, subcontractors, and
              site supervisors. We process this information solely to update project schedules, generate daily
              progress reports, and flag delays or risks. We do not use WhatsApp message content for any purpose
              beyond delivering the Services.
            </p>
            <p>
              WhatsApp message data is transmitted and stored in accordance with our security measures described in
              section 9. Meta Platforms processes message metadata subject to their own privacy policy. We recommend
              reviewing{" "}
              <a href="https://www.whatsapp.com/legal/privacy-policy" style={{ color: "var(--accent)" }}>
                WhatsApp&apos;s Privacy Policy
              </a>{" "}
              for details on how Meta handles message data.
            </p>
          </PolicySection>

          <PolicySection id="sociallogins" title="7. How Do We Handle Your Social Logins?">
            <p>
              <em>
                If you choose to register or log in to our Services using a social media account, we may have access
                to certain information about you.
              </em>
            </p>
            <p>
              Our Services offer you the ability to register and log in using your third-party social media account
              details, such as your Google account. Where you choose to do this, we will receive certain profile
              information from your social media provider. The profile information we receive may vary depending on
              the provider but will typically include your name, email address, and profile picture.
            </p>
            <p>
              We will use the information we receive only for the purposes described in this Privacy Notice. Please
              note that we do not control, and are not responsible for, other uses of your personal information by
              your third-party social media provider. We recommend reviewing their privacy notices.
            </p>
          </PolicySection>

          <PolicySection id="inforetain" title="8. How Long Do We Keep Your Information?">
            <p>
              <em>
                We keep your information for as long as necessary to fulfil the purposes outlined in this Privacy
                Notice unless otherwise required by law.
              </em>
            </p>
            <p>
              We will only keep your personal information for as long as it is necessary for the purposes set out in
              this Privacy Notice, unless a longer retention period is required or permitted by law (such as tax,
              accounting, or other legal requirements).
            </p>
            <p>
              Upon termination or deletion of your account, we will delete or anonymise your personal information
              within <strong style={{ color: "var(--text)" }}>90 days (three months)</strong>. During this period,
              your data is retained solely to enable account recovery, resolve pending disputes, prevent fraud, and
              comply with applicable legal obligations. After this window, your data is permanently deleted from our
              active systems.
            </p>
            <p>
              Certain records (such as billing and audit logs) may be retained for longer periods where required by
              law. Where deletion is not immediately possible, we will securely isolate your personal information
              from any further processing until deletion can be completed.
            </p>
          </PolicySection>

          <PolicySection id="infosafe" title="9. How Do We Keep Your Information Safe?">
            <p>
              <em>
                We aim to protect your personal information through appropriate organisational and technical security
                measures.
              </em>
            </p>
            <p>
              We have implemented reasonable technical and organisational security measures designed to protect the
              security of any personal information we process. However, no electronic transmission over the Internet
              or information storage technology can be guaranteed to be 100% secure. While we will do our best to
              protect your personal information, transmission of personal information to and from our Services is at
              your own risk. You should only access the Services within a secure environment.
            </p>
          </PolicySection>

          <PolicySection id="infominors" title="10. Do We Collect Information From Minors?">
            <p>
              <em>We do not knowingly collect data from or market to individuals under 18 years of age.</em>
            </p>
            <p>
              We do not knowingly collect or solicit data from individuals under 18 years of age. By using the
              Services, you represent that you are at least 18 years of age. If we learn that personal information
              from users under 18 years of age has been collected, we will deactivate the account and take reasonable
              measures to promptly delete such data from our records. If you become aware of any data we may have
              collected from individuals under age 18, please contact us at{" "}
              <a href="mailto:aishna@bluq.ai" style={{ color: "var(--accent)" }}>aishna@bluq.ai</a> or{" "}
              <a href="mailto:kalyani@bluq.ai" style={{ color: "var(--accent)" }}>kalyani@bluq.ai</a>.
            </p>
          </PolicySection>

          <PolicySection id="privacyrights" title="11. What Are Your Privacy Rights?">
            <p>
              <em>You may review, change, or terminate your account at any time.</em>
            </p>
            <p>
              <strong>Withdrawing your consent.</strong> If we are relying on your consent to process your personal
              information, you have the right to withdraw your consent at any time by contacting us using the details
              provided in section 15.
            </p>
            <p>
              <strong>Account Information.</strong> If you would like to review or change the information in your
              account or terminate your account, you can log in to your account settings or contact us. Upon your
              request to terminate your account, we will deactivate or delete your account and information from our
              active databases within 90 days. However, we may retain certain information where necessary to prevent
              fraud, assist with investigations, enforce our legal terms, and/or comply with applicable legal
              requirements.
            </p>
            <p>
              <strong>Cookies and similar technologies.</strong> Most web browsers are set to accept cookies by
              default. You can usually choose to set your browser to remove or reject browser cookies at any time.
            </p>
            <p>
              If you have questions or comments about your privacy rights, you may email us at{" "}
              <a href="mailto:aishna@bluq.ai" style={{ color: "var(--accent)" }}>aishna@bluq.ai</a> or{" "}
              <a href="mailto:kalyani@bluq.ai" style={{ color: "var(--accent)" }}>kalyani@bluq.ai</a>.
            </p>
          </PolicySection>

          <PolicySection id="DNT" title="12. Controls for Do-Not-Track Features">
            <p>
              Most web browsers and some mobile operating systems and applications include a Do-Not-Track
              (&quot;DNT&quot;) feature or setting you can activate to signal your privacy preference not to have data
              about your online browsing activities monitored and collected. At this stage, no uniform technology
              standard for recognising and implementing DNT signals has been finalised. As such, we do not currently
              respond to DNT browser signals or any other mechanism that automatically communicates your choice not to
              be tracked online. If a standard for online tracking is adopted that we must follow in the future, we
              will inform you about that practice in a revised version of this Privacy Notice.
            </p>
          </PolicySection>

          <PolicySection id="dpdpa" title="13. India DPDPA Compliance and Data Breach Notification">
            <p>
              <em>
                Bluq Technologies Private Limited is an Indian company and complies with the Digital Personal Data
                Protection Act, 2023 (DPDPA).
              </em>
            </p>
            <p>
              Under the DPDPA, we act as a <strong style={{ color: "var(--text)" }}>Data Fiduciary</strong> with
              respect to the personal data we collect and process. We process your personal data only for the specific
              purposes disclosed in this Privacy Notice and only to the extent necessary for those purposes.
            </p>
            <p>
              <strong>Your rights under DPDPA include:</strong>
            </p>
            <ul>
              <li>The right to access a summary of your personal data we hold and the processing activities carried out.</li>
              <li>The right to correction and erasure of inaccurate or incomplete personal data.</li>
              <li>The right to grievance redressal: any grievance will be acknowledged within 48 hours and resolved within 30 days.</li>
              <li>The right to nominate another individual to exercise your rights on your behalf in the event of your incapacity or death.</li>
            </ul>
            <p>
              <strong>Data Breach Notification.</strong> In the event of a personal data breach that is likely to
              result in risk to your rights, we will notify you and the relevant Data Protection Board of India
              without undue delay and, where feasible, within 72 hours of becoming aware of the breach. The
              notification will include the nature of the breach, the categories and approximate number of individuals
              affected, likely consequences, and the measures taken or proposed to address the breach.
            </p>
            <p>
              To raise a grievance or exercise your rights under the DPDPA, please contact our grievance officer at{" "}
              <a href="mailto:aishna@bluq.ai" style={{ color: "var(--accent)" }}>aishna@bluq.ai</a> or{" "}
              <a href="mailto:kalyani@bluq.ai" style={{ color: "var(--accent)" }}>kalyani@bluq.ai</a>.
            </p>
          </PolicySection>

          <PolicySection id="policyupdates" title="14. Do We Make Updates to This Notice?">
            <p>
              <em>Yes, we will update this notice as necessary to stay compliant with relevant laws.</em>
            </p>
            <p>
              We may update this Privacy Notice from time to time. The updated version will be indicated by a revised
              &quot;Last updated&quot; date at the top of this Privacy Notice. If we make material changes, we may
              notify you either by prominently posting a notice of such changes or by sending you a direct
              notification. We encourage you to review this Privacy Notice periodically to stay informed of how we
              are protecting your information.
            </p>
          </PolicySection>

          <PolicySection id="contact" title="15. How Can You Contact Us About This Notice?">
            <p>
              If you have questions or comments about this notice, please email us at{" "}
              <a href="mailto:aishna@bluq.ai" style={{ color: "var(--accent)" }}>aishna@bluq.ai</a> or{" "}
              <a href="mailto:kalyani@bluq.ai" style={{ color: "var(--accent)" }}>kalyani@bluq.ai</a>, or write to us at:
            </p>
            <p style={{ marginTop: 16 }}>
              <strong>Bluq Technologies Private Limited</strong><br />
              India
            </p>
          </PolicySection>

          <PolicySection id="request" title="16. How Can You Review, Update, or Delete the Data We Collect From You?">
            <p>
              Based on the applicable laws of your country, you may have the right to request access to the personal
              information we collect from you, details about how we have processed it, correction of inaccuracies, or
              deletion of your personal information. You may also have the right to withdraw your consent to our
              processing of your personal information. These rights may be limited in some circumstances by applicable
              law.
            </p>
            <p>
              To request to review, update, or delete your personal information, please visit{" "}
              <a href="https://bluq.ai/contact" style={{ color: "var(--accent)" }}>https://bluq.ai/contact</a> or
              email us at{" "}
              <a href="mailto:aishna@bluq.ai" style={{ color: "var(--accent)" }}>aishna@bluq.ai</a> or{" "}
              <a href="mailto:kalyani@bluq.ai" style={{ color: "var(--accent)" }}>kalyani@bluq.ai</a>.
            </p>
          </PolicySection>
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
        .pp-h3 {
          font-size: 1rem;
          font-weight: 700;
          color: #fff;
          margin: 28px 0 10px;
        }
      `}</style>
    </>
  );
}

function PolicySection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
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
