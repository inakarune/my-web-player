import firebase from "firebase/compat/app";
import "firebase/compat/storage";
import { app, auth, db, firebaseConfig, storage } from "./config/firebase";

export { app, auth, db, firebaseConfig, storage };

/** MusicPlayer 등 compat API — modular `initializeApp`과 동일한 [DEFAULT] 앱 사용 */
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export default app;
