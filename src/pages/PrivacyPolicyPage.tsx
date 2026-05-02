import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CmsRenderer from "@/components/CmsRenderer";
import { Shield, AlertTriangle, Eye, Bot, Globe, Trash2 } from "lucide-react";

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CmsRenderer slug="privacy-policy" fallback={
        <>
          <div className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16">
            <div className="container text-center">
              <Shield className="mx-auto h-12 w-12 text-primary" />
              <h1 className="mt-4 font-display text-4xl font-bold text-foreground">Privacy Policy & Global Terms of Use</h1>
              <p className="mt-3 text-lg text-muted-foreground">Please read these terms carefully before using PetsRegistry.org</p>
            </div>
          </div>

          <div className="container max-w-3xl py-12 space-y-10">
            {/* Section 1 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">1. No Liability & "User-Bears-All" Risk</h2>
              </div>
              <div className="space-y-4 text-muted-foreground leading-relaxed pl-[52px]">
                <p>PetsRegistry.org is a neutral platform provider only.</p>
                <div>
                  <h3 className="font-semibold text-foreground">Complete Disclaimer</h3>
                  <p>We are not responsible for the safety, health, or recovery of any pet. The user assumes 100% of the risk associated with registering a pet, meeting strangers to recover a pet, or following any advice from our AI or directory.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">No Warranty</h3>
                  <p>We do not guarantee that the website will be online, that QR codes will work, or that data will be saved. You use this service at your own peril.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Release of Claims</h3>
                  <p>By clicking "Register," you irrevocably release PetsRegistry.org and its owners from any and all claims, lawsuits, or damages (direct or indirect) forever.</p>
                </div>
              </div>
            </section>

            {/* Section 2 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <Eye className="h-5 w-5 text-accent" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">2. Privacy & Public Exposure</h2>
              </div>
              <div className="space-y-4 text-muted-foreground leading-relaxed pl-[52px]">
                <div>
                  <h3 className="font-semibold text-foreground">Intentional Public Data</h3>
                  <p>You understand that the purpose of this site is to help people find your pet. Therefore, any data you provide (Phone, Email, Photo) may become publicly accessible via search or QR scan.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Data Responsibility</h3>
                  <p>You are solely responsible for the privacy of the data you upload. If your data is stolen, scraped, or misused by third parties, you agree not to hold us responsible.</p>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">3. AI & Professional Advice</h2>
              </div>
              <div className="space-y-4 text-muted-foreground leading-relaxed pl-[52px]">
                <div>
                  <h3 className="font-semibold text-foreground">Not a Professional</h3>
                  <p>Our "AI Pets Expert" is a machine learning model. It is not a veterinarian, lawyer, or professional trainer.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Harmful Advice</h3>
                  <p>If the AI gives advice that leads to injury or loss, the user acknowledges they followed that advice at their own discretion and cannot blame the website.</p>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <Globe className="h-5 w-5 text-foreground" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">4. Governing Law: International Principles</h2>
              </div>
              <div className="space-y-4 text-muted-foreground leading-relaxed pl-[52px]">
                <p>This agreement is governed by the <strong className="text-foreground">UNIDROIT Principles of International Commercial Contracts (2016)</strong>.</p>
                <div>
                  <h3 className="font-semibold text-foreground">Neutrality</h3>
                  <p>Any dispute arising from this website shall be settled through binding arbitration in a neutral location chosen by the website owner, or via an online dispute resolution (ODR) platform.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Global Compliance</h3>
                  <p>While we strive to follow general data principles (like GDPR), the user acknowledges that this website operates globally. If the website is illegal in your specific country, you are forbidden from using it. Use of this site constitutes your confirmation that you are not violating local laws.</p>
                </div>
              </div>
            </section>

            {/* Section 5 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">5. Termination of Service</h2>
              </div>
              <div className="text-muted-foreground leading-relaxed pl-[52px]">
                <p>We reserve the right to delete any account, pet, or business listing at any time, for any reason, without notice and without refund of any "Guardian" or "Partner" fees.</p>
              </div>
            </section>

            <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                By using PetsRegistry.org, you acknowledge that you have read, understood, and agree to all the terms stated above.
              </p>
            </div>
          </div>
        </>
      } />
      <Footer />
    </div>
  );
};

export default PrivacyPolicyPage;
