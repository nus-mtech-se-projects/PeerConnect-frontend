/**
 * Azure Static Web Apps built-in Entra ID authentication helpers.
 *
 * Login/logout is handled by the SWA platform at the paths below.
 * After login, /.auth/me returns the signed-in user's clientPrincipal.
 *
 * Azure App Registration used:
 *   Tenant ID : e7fd6993-e646-4b0e-a981-d38362d2d061
 *   Client ID : 57cf3921-0d5b-4c96-9277-10a54818b823
 * (configured in the Azure Static Web Apps portal – no client-side secrets needed)
 */

export const SWA_LOGIN_URL = "/auth/login/aad";
export const SWA_LOGOUT_URL = "/auth/logout";

/**
 * Fetches the currently signed-in user from the SWA auth endpoint.
 * Returns the clientPrincipal object, or null if the user is not authenticated.
 */
export async function getSwaUser() {
  try {
    const res = await fetch("/.auth/me");
    const data = await res.json();
    return data.clientPrincipal ?? null;
  } catch {
    return null;
  }
}
