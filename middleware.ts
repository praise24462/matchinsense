import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        // These pages require login — redirect to sign-in if no session
        const protectedPaths = ["/saved"];
        if (protectedPaths.some((p) => pathname.startsWith(p))) {
          return !!token;
        }
        // All other pages are public
        return true;
      },
    },
  }
);

export const config = {
  matcher: ["/saved/:path*"],
};
