import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import logo from "@/assets/logo.png";
import CmsRenderer from "@/components/CmsRenderer";
import { useAuth } from "@/contexts/AuthContext";
import { useCmsPage } from "@/hooks/useCmsPage";
import { useStoreEnabled } from "@/hooks/useStoreEnabled";
import { useIsMobileRoute } from "@/hooks/useIsMobileRoute";

const Footer = () => {
  const { user } = useAuth();
  const { storeEnabled } = useStoreEnabled();
  const footerRef = useRef<HTMLDivElement>(null);
  const isMobileRoute = useIsMobileRoute();
  const { hasCmsContent, isLoading, html } = useCmsPage("footer");

  // CMS-authored footers may include a Sign Up link — hide it for logged-in users.
  useEffect(() => {
    const root = footerRef.current;
    if (!root) return;

    root.querySelectorAll('a[href="/register"], a[href$="/register"]').forEach((link) => {
      const row = link.closest("li") ?? link;
      (row as HTMLElement).style.display = user ? "none" : "";
    });
  }, [user, hasCmsContent, isLoading, html, storeEnabled]);

  // CMS footers may include Store links — hide when the store is off.
  useEffect(() => {
    const root = footerRef.current;
    if (!root || storeEnabled) return;

    root.querySelectorAll('a[href="/store"], a[href$="/store"], a[href="/m/store"], a[href$="/m/store"]').forEach((link) => {
      const row = link.closest("li") ?? link;
      (row as HTMLElement).style.display = "none";
    });
  }, [storeEnabled, hasCmsContent, isLoading, html]);

  if (isMobileRoute) return null;

  const defaultFooter = (
    <footer className="border-t border-border bg-card">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center">
              <img src={logo} alt="Pets Registry" className="h-11 w-auto" width={161} height={44} />
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Register your pets, keep them safe, and help reunite lost pets with their owners.
            </p>
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Quick Links</h3>
            <ul className="mt-3 space-y-2 text-md text-muted-foreground">
              <li><Link to="/search" className="hover:text-primary transition-colors">Find a Pet</Link></li>
              {storeEnabled && (
                <li><Link to="/store" className="hover:text-primary transition-colors">Store</Link></li>
              )}
              <li><Link to="/directory" className="hover:text-primary transition-colors">Directory</Link></li>
              <li><Link to="/about" className="hover:text-primary transition-colors">About Us</Link></li>
              {!user && (
                <li><Link to="/register" className="hover:text-primary transition-colors">Sign Up</Link></li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Support</h3>
            <ul className="mt-3 space-y-2 text-md text-muted-foreground">
              <li><Link to="/contact" className="hover:text-primary transition-colors">Contact Us</Link></li>
              <li><Link to="/fees" className="hover:text-primary transition-colors">Fees & Pricing</Link></li>
              <li><Link to="/verify" className="hover:text-primary transition-colors">Verify Certificate</Link></li>
              <li><Link to="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link to="/resources" className="hover:text-primary transition-colors">Resources</Link></li>
              <li><Link to="/donate" className="hover:text-primary transition-colors">Donate</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Contact</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>admin@petsregistry.org</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} PetsRegistry. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );

  return (
    <div ref={footerRef}>
      <CmsRenderer slug="footer" fallback={defaultFooter} />
    </div>
  );
};

export default Footer;
