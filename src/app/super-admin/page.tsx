"use client";

import { AuthGuard } from "../components/AuthGuard";
import ManagementConsole from "../components/ManagementConsole";

export default function SuperAdminPage() {
  return (
    <AuthGuard allowedRoles={["SUPER_ADMIN"]}>
      <ManagementConsole mode="super" />
    </AuthGuard>
  );
}
