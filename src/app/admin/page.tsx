"use client";

import { AuthGuard } from "../components/AuthGuard";
import ManagementConsole from "../components/ManagementConsole";

export default function AdminPage() {
  return (
    <AuthGuard allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
      <ManagementConsole mode="admin" />
    </AuthGuard>
  );
}
