import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence, getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyCpg4UmWmMpf3d0eYp_EF0wS6_Vi1IjtoQ",
  authDomain: "barber-pro-297c6.firebaseapp.com",
  projectId: "barber-pro-297c6",
  storageBucket: "barber-pro-297c6.firebasestorage.app",
  messagingSenderId: "724683872186",
  appId: "1:724683872186:web:65fe7af8d439aa7360ef83"
};

const app = initializeApp(firebaseConfig);

let auth;

if (Platform.OS === 'web') {
  auth = getAuth(app);
  setPersistence(auth, browserLocalPersistence);
} else {
  // @ts-ignore
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
}

export { auth };
export const db = getFirestore(app);