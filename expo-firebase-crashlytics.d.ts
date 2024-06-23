declare module 'expo-firebase-crashlytics' {
    export function initializeCrashlytics(app: any): void;
    export function recordError(error: any): void;
    export function log(message: string): void;
  }
  