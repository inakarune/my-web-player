import { initializeApp, getApp, getApps } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

/**
 * my-web-player (react-player) — Firebase Web SDK 설정
 * Hosting 배포: `npm run build` 후 `firebase deploy --only hosting`
 */
export const firebaseConfig = {
  apiKey: "AIzaSyCyTWf-mxvkDHVqeD23U1WfU1jbZxfbNBk",
  authDomain: "mywebplayer-9c3ef.firebaseapp.com",
  databaseURL: "https://mywebplayer-9c3ef.firebaseio.com",
  projectId: "mywebplayer-9c3ef",
  storageBucket: "mywebplayer-9c3ef.appspot.com",
  messagingSenderId: "97871996793",
  appId: "1:97871996793:web:d9105e30a79213d54371a8",
  measurementId: "G-P01RDN9Y8X",
};

function getOrInitApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export const app = getOrInitApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/** Analytics는 일부 환경(SSR, 지원 안 되는 브라우저)에서만 초기화 */
let analyticsPromise = null;
export function getAnalyticsWhenSupported() {
  if (analyticsPromise) return analyticsPromise;
  analyticsPromise = isSupported()
    .then((ok) => (ok ? getAnalytics(app) : null))
    .catch(() => null);
  return analyticsPromise;
}

getAnalyticsWhenSupported();
