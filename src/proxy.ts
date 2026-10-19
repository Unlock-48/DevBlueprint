import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((request) => {
  const isAuthenticated = Boolean(request.auth);
  const path = request.nextUrl.pathname;

  if (!isAuthenticated && (path === "/" || path === "/settings")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthenticated && (path === "/login" || path === "/register")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/", "/settings", "/login", "/register"],
};
