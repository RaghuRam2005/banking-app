import { NextResponse } from 'next/server'

export function middleware(request) {
  const session = request.cookies.get('nova-user-session')?.value
  const pathname = request.nextUrl.pathname

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const user = JSON.parse(session)

    if (pathname.startsWith('/admin') && user.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  } catch (e) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
}
