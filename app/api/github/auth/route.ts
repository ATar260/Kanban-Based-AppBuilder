import { NextRequest, NextResponse } from 'next/server';

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
};

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(
            new URL(`/?github_error=${encodeURIComponent(error)}`, request.url)
        );
    }

    if (!code) {
        return NextResponse.redirect(
            new URL('/?github_error=no_code', request.url)
        );
    }

    try {
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
            }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            return NextResponse.redirect(
                new URL(`/?github_error=${encodeURIComponent(tokenData.error)}`, request.url)
            );
        }

        const accessToken = tokenData.access_token;

        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        const userData = await userResponse.json();

        const redirectUrl = new URL('/', request.url);
        redirectUrl.searchParams.set('github_connected', 'true');
        redirectUrl.searchParams.set('github_username', userData.login);
        redirectUrl.searchParams.set('github_avatar', userData.avatar_url || '');

        const response = NextResponse.redirect(redirectUrl);
        
        response.cookies.set('github_token', accessToken, COOKIE_OPTIONS);
        response.cookies.set('github_username', userData.login, { ...COOKIE_OPTIONS, httpOnly: false });

        return response;

    } catch (error: any) {
        return NextResponse.redirect(
            new URL(`/?github_error=${encodeURIComponent(error.message)}`, request.url)
        );
    }
}
