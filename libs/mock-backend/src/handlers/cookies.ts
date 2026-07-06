/** Extracts a single cookie's value from a raw `Cookie` request header, e.g. `parseCookie(request.headers.get('cookie'), 'refreshToken')`. */
export function parseCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader
    .split(';')
    .map((pair) => pair.trim())
    .find((pair) => pair.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}
