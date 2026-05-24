import { auth } from "@/lib/auth";

export default auth((req) => {
  const isApp = req.nextUrl.pathname.startsWith("/app");

  if (isApp && !req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/app/:path*"],
};
