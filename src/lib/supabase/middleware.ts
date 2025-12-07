import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshing the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Define route categories
  const isStaffRoute =
    request.nextUrl.pathname.startsWith('/projects') ||
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname === '/';

  const isCustomerRoute = request.nextUrl.pathname.startsWith('/customer');
  const isLoginRoute = request.nextUrl.pathname === '/login';
  const isPublicRoute = request.nextUrl.pathname.startsWith('/status/');

  // Allow public routes without auth
  if (isPublicRoute) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to login for protected routes
  if (!user && (isStaffRoute || isCustomerRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Handle authenticated users
  if (user) {
    // Fetch profile to get role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isCustomer = profile?.role === 'customer';

    // Redirect logged-in users away from login page based on role
    if (isLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = isCustomer ? '/customer' : '/';
      return NextResponse.redirect(url);
    }

    // Customer trying to access staff routes -> redirect to customer portal
    if (isCustomer && isStaffRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/customer';
      return NextResponse.redirect(url);
    }

    // Staff trying to access customer portal -> redirect to dashboard
    if (!isCustomer && isCustomerRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
