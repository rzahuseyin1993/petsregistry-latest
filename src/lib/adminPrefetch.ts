/** Lazy chunk prefetch map — mirrors App.tsx admin route imports. */
const ADMIN_ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
  "/admin": () => import("@/pages/AdminDashboard"),
  "/admin/users": () => import("@/pages/AdminUsers"),
  "/admin/pets": () => import("@/pages/AdminPets"),
  "/admin/orders": () => import("@/pages/AdminOrders"),
  "/admin/products": () => import("@/pages/AdminProducts"),
  "/admin/payments": () => import("@/pages/AdminPayments"),
  "/admin/service-subscriptions": () => import("@/pages/AdminServiceSubscriptions"),
  "/admin/adoptions": () => import("@/pages/AdminAdoptions"),
  "/admin/lost-reports": () => import("@/pages/AdminLostReports"),
  "/admin/flyer-templates": () => import("@/pages/AdminFlyerTemplates"),
  "/admin/flyer-editor": () => import("@/pages/AdminFlyerEditor"),
  "/admin/directory": () => import("@/pages/AdminDirectory"),
  "/admin/memberships": () => import("@/pages/AdminMemberships"),
  "/admin/contacts": () => import("@/pages/AdminContacts"),
  "/admin/donations": () => import("@/pages/AdminDonations"),
  "/admin/settings": () => import("@/pages/AdminSettings"),
  "/admin/page-builder": () => import("@/pages/AdminPageBuilder"),
  "/admin/permissions": () => import("@/pages/AdminPermissions"),
  "/admin/moderation": () => import("@/pages/AdminModeration"),
  "/admin/certificates": () => import("@/pages/AdminCertificates"),
  "/admin/map-settings": () => import("@/pages/AdminMapSettings"),
  "/admin/seo": () => import("@/pages/AdminSeo"),
  "/admin/blog": () => import("@/pages/AdminBlog"),
};

const prefetched = new Set<string>();

export const prefetchAdminRoute = (path: string) => {
  const loader = ADMIN_ROUTE_LOADERS[path];
  if (!loader || prefetched.has(path)) return;
  prefetched.add(path);
  void loader();
};

export const prefetchAllAdminRoutes = () => {
  Object.keys(ADMIN_ROUTE_LOADERS).forEach(prefetchAdminRoute);
};
