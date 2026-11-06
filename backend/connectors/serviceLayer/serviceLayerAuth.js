const DEFAULT_LOGIN_PATH = '/b1s/v1/Login';

class ServiceLayerAuthError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'ServiceLayerAuthError';
    this.statusCode = statusCode;
  }
}

function getCookieHeader(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ');
  }
  const cookie = headers.get('set-cookie');
  return cookie ? cookie.split(',').map((part) => part.trim().split(';')[0]).join('; ') : '';
}

function createServiceLayerAuth({
  baseUrl,
  username,
  password,
  companyDB,
  fetchImpl = globalThis.fetch,
  loginPath = DEFAULT_LOGIN_PATH,
}) {
  if (!baseUrl) throw new Error('Service Layer baseUrl is required');
  if (typeof fetchImpl !== 'function') throw new Error('A Fetch-compatible implementation is required');

  let cookieHeader = '';
  let loggedIn = false;

  async function login() {
    const response = await fetchImpl(new URL(loginPath, baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ CompanyDB: companyDB, UserName: username, Password: password }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ServiceLayerAuthError(`Service Layer login failed (${response.status})${detail ? `: ${detail}` : ''}`, response.status);
    }
    cookieHeader = getCookieHeader(response.headers);
    if (!cookieHeader || !/(^|;\s*)B1SESSION=/.test(cookieHeader)) {
      throw new ServiceLayerAuthError('Service Layer login succeeded but did not return a B1SESSION cookie');
    }
    loggedIn = true;
    return cookieHeader;
  }

  function getCookie() { return cookieHeader; }
  function isLoggedIn() { return loggedIn; }
  function clear() { cookieHeader = ''; loggedIn = false; }

  return { login, getCookie, isLoggedIn, clear };
}

module.exports = { createServiceLayerAuth, ServiceLayerAuthError };
