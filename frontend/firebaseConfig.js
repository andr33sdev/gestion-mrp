// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA96C7rFf2MkEMSspMCYBDj7SgoqnFulPQ",
  authDomain: "gestion-mrp-cd072.firebaseapp.com",
  projectId: "gestion-mrp-cd072",
  storageBucket: "gestion-mrp-cd072.firebasestorage.app",
  messagingSenderId: "574060322032",
  appId: "1:574060322032:web:231b430cdae5fe9de0b635",
  measurementId: "G-DTV5S4R92R",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
