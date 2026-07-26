import { lazy, Suspense, useEffect } from "react";
import NavigationOverlay from "@/components/NavigationOverlay";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route } from "react-router-dom";
import DeferredNavigation from "@/components/DeferredNavigation";
import ScrollToTop from "@/components/ScrollToTop";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { VisitorGeoProvider } from "@/contexts/VisitorGeoContext";
import { CartProvider } from "@/contexts/CartContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminPageWrapper from "@/components/AdminPageWrapper";
import AdminLayout from "@/components/AdminLayout";
import MaintenanceGate from "@/components/MaintenanceGate";
const Index = lazy(() => import("./pages/Index"));
const MobileGuard = lazy(() => import("./components/MobileGuard"));

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Lazy-loaded pages — split into separate chunks to reduce initial bundle
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const RegisterPet = lazy(() => import("./pages/RegisterPet"));
const EditPet = lazy(() => import("./pages/EditPet"));
const PetProfile = lazy(() => import("./pages/PetProfile"));
const StorePage = lazy(() => import("./pages/StorePage"));
const SearchPage = lazy(() => import("./pages/PublicSearchPage"));
const ReportLostPage = lazy(() => import("./pages/ReportLostPage"));
const ScanLandingPage = lazy(() => import("./pages/ScanLandingPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminPets = lazy(() => import("./pages/AdminPets"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));
const AdminProducts = lazy(() => import("./pages/AdminProducts"));
const AdminPayments = lazy(() => import("./pages/AdminPayments"));
const AdminServiceSubscriptions = lazy(() => import("./pages/AdminServiceSubscriptions"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminPageBuilder = lazy(() => import("./pages/AdminPageBuilder"));
const DashboardSettings = lazy(() => import("./pages/DashboardSettings"));
const PetExpert = lazy(() => import("./pages/PetExpert"));
const PetHealth = lazy(() => import("./pages/PetHealth"));
const DashboardAdoption = lazy(() => import("./pages/DashboardAdoption"));
const DashboardMembership = lazy(() => import("./pages/DashboardMembership"));
const AdoptionPage = lazy(() => import("./pages/AdoptionPage"));
const AdminAdoptions = lazy(() => import("./pages/AdminAdoptions"));
const LostPetsPage = lazy(() => import("./pages/LostPetsPage"));
const LostPetsCountryFeedPage = lazy(() => import("./pages/LostPetsCountryFeedPage"));
const DashboardLostReports = lazy(() => import("./pages/DashboardLostReports"));
const AdminLostReports = lazy(() => import("./pages/AdminLostReports"));
const LostFlyerBuilder = lazy(() => import("./pages/LostFlyerBuilder"));
const AdminFlyerTemplates = lazy(() => import("./pages/AdminFlyerTemplates"));
const AdminFlyerEditor = lazy(() => import("./pages/AdminFlyerEditor"));
const BusinessDirectory = lazy(() => import("./pages/BusinessDirectory"));
const BusinessProfile = lazy(() => import("./pages/BusinessProfile"));
const DashboardDirectory = lazy(() => import("./pages/DashboardDirectory"));
const AdminDirectory = lazy(() => import("./pages/AdminDirectory"));
const AdminMemberships = lazy(() => import("./pages/AdminMemberships"));
const MembershipPage = lazy(() => import("./pages/MembershipPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const AdminContacts = lazy(() => import("./pages/AdminContacts"));
const AdminDonations = lazy(() => import("./pages/AdminDonations"));
const DashboardInbox = lazy(() => import("./pages/DashboardInbox"));
const DonatePage = lazy(() => import("./pages/DonatePage"));
const PetMapPage = lazy(() => import("./pages/PetMapPage"));
const DashboardOrders = lazy(() => import("./pages/DashboardOrders"));
const AdminPermissions = lazy(() => import("./pages/AdminPermissions"));
const DashboardCertificates = lazy(() => import("./pages/DashboardCertificates"));
const LitterRegistration = lazy(() => import("./pages/LitterRegistration"));
const AdminCertificates = lazy(() => import("./pages/AdminCertificates"));
const AdminMapSettings = lazy(() => import("./pages/AdminMapSettings"));
const AdminSeo = lazy(() => import("./pages/AdminSeo"));
const AdminBlog = lazy(() => import("./pages/AdminBlog"));
const ResourcesPage = lazy(() => import("./pages/ResourcesPage"));
const DashboardArticles = lazy(() => import("./pages/DashboardArticles"));

const ResourcePost = lazy(() => import("./pages/ResourcePost"));
const CertificateVerify = lazy(() => import("./pages/CertificateVerify"));
const FeesPage = lazy(() => import("./pages/FeesPage"));
const AdminModeration = lazy(() => import("./pages/AdminModeration"));
const TrackingCodeInjector = lazy(() => import("./components/TrackingCodeInjector"));

// Lazy-loaded mobile pages
const MobileLayout = lazy(() => import("./components/mobile/MobileLayout"));
const MobileHome = lazy(() => import("./pages/mobile/MobileHome"));
const MobileSearch = lazy(() => import("./pages/mobile/MobileSearch"));
const MobileAdopt = lazy(() => import("./pages/mobile/MobileAdopt"));
const MobileStore = lazy(() => import("./pages/mobile/MobileStore"));
const MobileLostPets = lazy(() => import("./pages/mobile/MobileLostPets"));
const MobileLostPetsCountryFeed = lazy(() => import("./pages/mobile/MobileLostPetsCountryFeed"));
const MobileDirectory = lazy(() => import("./pages/mobile/MobileDirectory"));
const MobileDashboard = lazy(() => import("./pages/mobile/MobileDashboard"));
const MobileInbox = lazy(() => import("./pages/mobile/MobileInbox"));
const MobilePetExpert = lazy(() => import("./pages/mobile/MobilePetExpert"));
const MobileMembership = lazy(() => import("./pages/mobile/MobileMembership"));
const MobileScan = lazy(() => import("./pages/mobile/MobileScan"));
const MobileOrders = lazy(() => import("./pages/mobile/MobileOrders"));

const queryClient = new QueryClient();

// Areas where copy/paste/right-click should remain fully enabled (admin + member dashboards)
const isPrivilegedPath = (path: string) => {
  // Strip the optional /m mobile prefix so /m/dashboard counts the same as /dashboard
  const p = path.startsWith('/m/') ? path.slice(2) : path === '/m' ? '/' : path;
  return p.startsWith('/admin') || p.startsWith('/dashboard');
};

function AppWithProviders() {
  useEffect(() => {
    const isPrivileged = () => isPrivilegedPath(window.location.pathname);

    // Toggle a body class so CSS can re-enable text selection in privileged areas
    const syncBodyClass = () => {
      document.body.classList.toggle('privileged-area', isPrivileged());
    };
    syncBodyClass();
    // Re-sync on client-side route changes (history API + back/forward)
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function (...args) {
      const r = origPush.apply(this, args as any);
      queueMicrotask(syncBodyClass);
      return r;
    };
    history.replaceState = function (...args) {
      const r = origReplace.apply(this, args as any);
      queueMicrotask(syncBodyClass);
      return r;
    };
    window.addEventListener('popstate', syncBodyClass);

    // Disable right-click context menu (skip in admin/dashboard)
    const handleContextMenu = (e: MouseEvent) => {
      // if (isPrivileged()) return;
      // e.preventDefault();
    };

    // Disable save/view-source/print shortcuts (skip in admin/dashboard).
    // Plain text copy (Ctrl+C/X) stays enabled everywhere so visitors can copy
    // pet registry IDs and certificate codes; images are protected separately
    // via the drag blocker and ProtectedImage watermarks.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPrivileged()) return;
      // Ctrl+U (view source), Ctrl+S (save), Ctrl+P (print)
      if (e.ctrlKey && ['u', 's', 'p'].includes(e.key.toLowerCase())) {
        const target = e.target as HTMLElement;
        if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;
        e.preventDefault();
      }
      // F12 (dev tools), Ctrl+Shift+I/J/C (dev tools)
      // if (e.key === 'F12') e.preventDefault();
      // if (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) {
      //   e.preventDefault();
      // }
      // PrintScreen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
      }
    };

    // Disable drag on images (always — protects pet photos everywhere)
    const handleDragStart = (e: DragEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'IMG') {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('dragstart', handleDragStart);

    return () => {
      history.pushState = origPush;
      history.replaceState = origReplace;
      window.removeEventListener('popstate', syncBodyClass);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <VisitorGeoProvider>
          <TrackingCodeInjector />
          <Suspense fallback={<NavigationOverlay mode="page" />}>
          <DeferredNavigation>
              {/* Desktop routes */}
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<ProtectedRoute adminOnly><AdminLayout /></ProtectedRoute>}>
                <Route index element={<AdminPageWrapper resource="dashboard"><AdminDashboard /></AdminPageWrapper>} />
                <Route path="users" element={<AdminPageWrapper resource="members"><AdminUsers /></AdminPageWrapper>} />
                <Route path="pets" element={<AdminPageWrapper resource="pets"><AdminPets /></AdminPageWrapper>} />
                <Route path="orders" element={<AdminPageWrapper resource="orders"><AdminOrders /></AdminPageWrapper>} />
                <Route path="products" element={<AdminPageWrapper resource="products"><AdminProducts /></AdminPageWrapper>} />
                <Route path="payments" element={<AdminPageWrapper resource="payments"><AdminPayments /></AdminPageWrapper>} />
                <Route path="service-subscriptions" element={<AdminPageWrapper resource="payments"><AdminServiceSubscriptions /></AdminPageWrapper>} />
                <Route path="adoptions" element={<AdminPageWrapper resource="pets"><AdminAdoptions /></AdminPageWrapper>} />
                <Route path="lost-reports" element={<AdminPageWrapper resource="lost_reports"><AdminLostReports /></AdminPageWrapper>} />
                <Route path="flyer-templates" element={<AdminPageWrapper resource="flyer_templates"><AdminFlyerTemplates /></AdminPageWrapper>} />
                <Route path="flyer-editor" element={<AdminPageWrapper resource="flyer_templates"><AdminFlyerEditor /></AdminPageWrapper>} />
                <Route path="directory" element={<AdminPageWrapper resource="directory"><AdminDirectory /></AdminPageWrapper>} />
                <Route path="memberships" element={<AdminPageWrapper resource="memberships"><AdminMemberships /></AdminPageWrapper>} />
                <Route path="contacts" element={<AdminPageWrapper resource="contacts"><AdminContacts /></AdminPageWrapper>} />
                <Route path="donations" element={<AdminPageWrapper resource="donations"><AdminDonations /></AdminPageWrapper>} />
                <Route path="settings" element={<AdminPageWrapper resource="settings"><AdminSettings /></AdminPageWrapper>} />
                <Route path="page-builder" element={<AdminPageWrapper resource="page_builder"><AdminPageBuilder /></AdminPageWrapper>} />
                <Route path="permissions" element={<AdminPageWrapper resource="permissions"><AdminPermissions /></AdminPageWrapper>} />
                <Route path="moderation" element={<AdminPageWrapper resource="permissions"><AdminModeration /></AdminPageWrapper>} />
                <Route path="certificates" element={<AdminPageWrapper resource="certificates"><AdminCertificates /></AdminPageWrapper>} />
                <Route path="map-settings" element={<AdminPageWrapper resource="settings"><AdminMapSettings /></AdminPageWrapper>} />
                <Route path="seo" element={<AdminPageWrapper resource="seo"><AdminSeo /></AdminPageWrapper>} />
                <Route path="blog" element={<AdminPageWrapper resource="blog"><AdminBlog /></AdminPageWrapper>} />
              </Route>
              <Route path="/pet/:id" element={<PetProfile />} />
              <Route path="/store" element={<StorePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/report-lost" element={<ReportLostPage />} />
              <Route path="/scan/:petId" element={<ScanLandingPage />} />
              <Route path="/pet-expert" element={<ProtectedRoute><PetExpert /></ProtectedRoute>} />
              <Route path="/pet-map" element={<PetMapPage />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard/register-pet" element={<ProtectedRoute><RegisterPet /></ProtectedRoute>} />
              <Route path="/dashboard/pets/:id/edit" element={<ProtectedRoute><EditPet /></ProtectedRoute>} />
              <Route path="/dashboard/health" element={<ProtectedRoute><PetHealth /></ProtectedRoute>} />
              <Route path="/dashboard/adoption" element={<ProtectedRoute><DashboardAdoption /></ProtectedRoute>} />
              <Route path="/dashboard/settings" element={<ProtectedRoute><DashboardSettings /></ProtectedRoute>} />
              <Route path="/dashboard/lost-reports" element={<ProtectedRoute><DashboardLostReports /></ProtectedRoute>} />
              <Route path="/dashboard/flyer-builder" element={<ProtectedRoute><LostFlyerBuilder /></ProtectedRoute>} />
              <Route path="/dashboard/directory" element={<ProtectedRoute><DashboardDirectory /></ProtectedRoute>} />
              <Route path="/dashboard/membership" element={<ProtectedRoute><DashboardMembership /></ProtectedRoute>} />
              <Route path="/dashboard/inbox" element={<ProtectedRoute><DashboardInbox /></ProtectedRoute>} />
              <Route path="/dashboard/orders" element={<ProtectedRoute><DashboardOrders /></ProtectedRoute>} />
              <Route path="/dashboard/certificates" element={<ProtectedRoute><DashboardCertificates /></ProtectedRoute>} />
              <Route path="/dashboard/register-litter" element={<ProtectedRoute><LitterRegistration /></ProtectedRoute>} />
              <Route path="/dashboard/articles" element={<ProtectedRoute adminOnly><DashboardArticles /></ProtectedRoute>} />
              
              <Route path="/adopt" element={<AdoptionPage />} />
              <Route path="/directory" element={<BusinessDirectory />} />
              <Route path="/directory/:id" element={<BusinessProfile />} />
              <Route path="/membership" element={<MembershipPage />} />
              <Route path="/donate" element={<DonatePage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/lost-pets/country/:country" element={<LostPetsCountryFeedPage />} />
              <Route path="/lost-pets" element={<LostPetsPage />} />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/resources/:slug" element={<ResourcePost />} />
              <Route path="/verify-certificate" element={<CertificateVerify />} />
              <Route path="/verify" element={<CertificateVerify />} />
              <Route path="/fees" element={<FeesPage />} />

              {/* Mobile routes */}
              <Route path="/m" element={<MobileGuard />}>
                <Route element={<MobileLayout />}>
                <Route index element={<MobileHome />} />
                <Route path="search" element={<MobileSearch />} />
                <Route path="scan" element={<MobileScan />} />
                <Route path="adopt" element={<MobileAdopt />} />
                <Route path="store" element={<MobileStore />} />
                <Route path="lost-pets/country/:country" element={<MobileLostPetsCountryFeed />} />
                <Route path="lost-pets" element={<MobileLostPets />} />
                <Route path="report-lost" element={<ReportLostPage />} />
                <Route path="directory" element={<MobileDirectory />} />
                <Route path="pet-expert" element={<ProtectedRoute><MobilePetExpert /></ProtectedRoute>} />
                <Route path="membership" element={<MobileMembership />} />
                <Route path="pet/:id" element={<PetProfile />} />
                <Route path="directory/:id" element={<BusinessProfile />} />
                <Route path="donate" element={<DonatePage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="contact" element={<ContactPage />} />
                <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
                <Route path="resources" element={<ResourcesPage />} />
                <Route path="resources/:slug" element={<ResourcePost />} />
                <Route path="pet-map" element={<PetMapPage />} />
                <Route path="fees" element={<FeesPage />} />
                <Route path="verify" element={<CertificateVerify />} />
                <Route path="verify-certificate" element={<CertificateVerify />} />
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="dashboard" element={<ProtectedRoute><MobileDashboard /></ProtectedRoute>} />
                <Route path="dashboard/inbox" element={<ProtectedRoute><MobileInbox /></ProtectedRoute>} />
                <Route path="dashboard/register-pet" element={<ProtectedRoute><RegisterPet /></ProtectedRoute>} />
                <Route path="dashboard/pets/:id/edit" element={<ProtectedRoute><EditPet /></ProtectedRoute>} />
                <Route path="dashboard/health" element={<ProtectedRoute><PetHealth /></ProtectedRoute>} />
                <Route path="dashboard/adoption" element={<ProtectedRoute><DashboardAdoption /></ProtectedRoute>} />
                <Route path="dashboard/lost-reports" element={<ProtectedRoute><DashboardLostReports /></ProtectedRoute>} />
                <Route path="dashboard/flyer-builder" element={<ProtectedRoute><LostFlyerBuilder /></ProtectedRoute>} />
                <Route path="dashboard/directory" element={<ProtectedRoute><DashboardDirectory /></ProtectedRoute>} />
                <Route path="dashboard/membership" element={<ProtectedRoute><DashboardMembership /></ProtectedRoute>} />
                <Route path="dashboard/settings" element={<ProtectedRoute><DashboardSettings /></ProtectedRoute>} />
                <Route path="dashboard/orders" element={<ProtectedRoute><MobileOrders /></ProtectedRoute>} />
                <Route path="dashboard/certificates" element={<ProtectedRoute><DashboardCertificates /></ProtectedRoute>} />
                <Route path="dashboard/register-litter" element={<ProtectedRoute><LitterRegistration /></ProtectedRoute>} />
                <Route path="dashboard/articles" element={<ProtectedRoute adminOnly><DashboardArticles /></ProtectedRoute>} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
          </DeferredNavigation>
          </Suspense>
          </VisitorGeoProvider>
        </BrowserRouter>
      </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
}

const App = () => (
  <MaintenanceGate>
    <AppWithProviders />
  </MaintenanceGate>
);

export default App;
