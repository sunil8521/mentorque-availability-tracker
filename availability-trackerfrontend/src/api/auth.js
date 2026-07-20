import { api, get, post } from "./client.js";

// DISABLED: Registration removed per assignment (data is pre-seeded)
// export async function register(data) {
//   return post("/api/auth/register", data);
// }

export async function login(data) {
  return post("/api/auth/login", data);
}

export async function me() {
  return api("GET", `/api/auth/me?_=${Date.now()}`, null, { skipAuthRedirect: true });
}

// Google OAuth functions (disabled on backend, kept here to satisfy unmodified AdminSettings imports)
export async function getGoogleAuthUrl() {
  const { url } = await get("/api/auth/google");
  return url;
}

export async function disconnectGoogle() {
  return post("/api/auth/google/disconnect");
}
