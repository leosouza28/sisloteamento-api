import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { logDev } from "../../util";
import * as serviceAccount from './lsdevelopers-loteamentos-api.json';

logDev("Apps", getApps().length);

const app = !getApps().length ? initializeApp({ credential: cert(serviceAccount as any), storageBucket: process.env.FIREBASE_STORAGE_BUCKET }) : getApp();
const storage = getStorage(app).bucket();

logDev("Firebase initialized");
logDev("Apps", getApps().length);

export { app, storage };