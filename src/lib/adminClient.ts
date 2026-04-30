import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

let authUserPromise: Promise<User | null> | null = null;

async function waitForAuthUser() {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  if (!authUserPromise) {
    authUserPromise = new Promise<User | null>((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        authUserPromise = null;
        resolve(user);
      });
    });
  }

  return authUserPromise;
}

export async function getAdminToken(forceRefresh = false) {
  const user = await waitForAuthUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  return user.getIdToken(forceRefresh);
}

export async function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const headers = new Headers(init.headers ?? {});
  const makeRequest = async (forceRefresh = false) => {
    const token = await getAdminToken(forceRefresh);
    headers.set("Authorization", `Bearer ${token}`);

    return fetch(input, {
      ...init,
      headers,
    });
  };

  const response = await makeRequest(false);

  if (response.status !== 401) {
    return response;
  }

  return makeRequest(true);
}
