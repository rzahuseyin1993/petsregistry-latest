import { Outlet } from "react-router-dom";
import AdminSidebar from "@/components/AdminSidebar";

/** Persistent shell for all /admin routes — sidebar stays mounted while content swaps. */
const AdminLayout = () => (
  <div className="flex min-h-screen">
    <AdminSidebar />
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Outlet />
    </div>
  </div>
);

export default AdminLayout;
