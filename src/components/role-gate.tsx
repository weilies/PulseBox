import type { Role } from "@/lib/constants";

const HIERARCHY: Role[] = ["tenant_admin", "super_admin"];

interface RoleGateProps {
  userRole: string | null;
  minRole: Role;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ userRole, minRole, children, fallback = null }: RoleGateProps) {
  if (!userRole) return <>{fallback}</>;
  if (HIERARCHY.indexOf(userRole as Role) < HIERARCHY.indexOf(minRole)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
