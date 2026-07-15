import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessTokenEdge, verifyTreeGuestTokenEdge } from "@/lib/auth/edgeJwt";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ROLE_HOME,
  ROLES,
  TREE_GUEST_COOKIE,
} from "@/lib/constants";

// Pages that require an authenticated session.
const PROTECTED_PREFIXES = ["/dashboard", "/talk", "/super-admin", "/admin"];

function isProtected(pathname: string): boolean {
  // The landing map at "/" requires authentication too.
  if (pathname === "/") return true;
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isProtected(pathname)) return NextResponse.next();

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  const treeGuestToken = req.cookies.get(TREE_GUEST_COOKIE)?.value;

  // A PIN-verified public tree session may open only its matching dashboard
  // and conversational view, without requiring an email/OTP account.
  const sharedTreeId = req.nextUrl.searchParams.get("tree");
  const sharedAccessKey = req.nextUrl.searchParams.get("share");
  if (
    sharedTreeId &&
    sharedAccessKey &&
    (pathname.startsWith("/dashboard") || pathname.startsWith("/talk"))
  ) {
    if (treeGuestToken) {
      const guest = await verifyTreeGuestTokenEdge(treeGuestToken);
      if (guest?.treeId === sharedTreeId && guest.accessKey === sharedAccessKey) {
        return NextResponse.next();
      }
    }
    const pinUrl = new URL(
      `/tree/${encodeURIComponent(sharedTreeId)}/${encodeURIComponent(sharedAccessKey)}`,
      req.url,
    );
    return NextResponse.redirect(pinUrl);
  }

  // No session at all → go sign in.
  if (!accessToken && !refreshToken) {
    return redirectToLogin(req);
  }

  if (accessToken) {
    const payload = await verifyAccessTokenEdge(accessToken);
    if (payload) {
      // Server-side role enforcement when the access token is valid.
      if (
        pathname.startsWith("/super-admin") &&
        payload.role !== ROLES.SUPER_ADMIN
      ) {
        return NextResponse.redirect(new URL(ROLE_HOME[payload.role], req.url));
      }
      if (
        pathname.startsWith("/admin") &&
        payload.role !== ROLES.ADMIN &&
        payload.role !== ROLES.SUPER_ADMIN
      ) {
        return NextResponse.redirect(new URL(ROLE_HOME[payload.role], req.url));
      }
      return NextResponse.next();
    }
  }

  // Access token missing/expired but a refresh session exists: allow the page to
  // load; the client AuthGuard will silently refresh and enforce the role.
  if (refreshToken) return NextResponse.next();

  return redirectToLogin(req);
}

function redirectToLogin(req: NextRequest): NextResponse {
  const url = new URL("/login", req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/talk/:path*",
    "/super-admin/:path*",
    "/admin/:path*",
  ],
};
