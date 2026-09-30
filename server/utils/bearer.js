/** Extract the token from an `Authorization: Bearer <token>` header, or null. */
export function readBearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}
