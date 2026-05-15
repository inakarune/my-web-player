// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebase from "firebase/compat/app";

// Firebase 설정 객체
const firebaseConfig = {
  apiKey: "AIzaSyCyTWf-mxvkDHVqeD23U1WfU1jbZxfbNBk",
  authDomain: "mywebplayer-9c3ef.firebaseapp.com",
  databaseURL: "https://mywebplayer-9c3ef.firebaseio.com",
  projectId: "mywebplayer-9c3ef",
  storageBucket: "mywebplayer-9c3ef.appspot.com",
  messagingSenderId: "97871996793",
  appId: "1:97871996793:web:d9105e30a79213d54371a8",
  measurementId: "G-P01RDN9Y8X",
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// Firebase 서비스 가져오기
export const auth = getAuth(app);
export const firestore = getFirestore(app);

// Firebase 초기화
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  firebase.analytics();
}

export default app;
