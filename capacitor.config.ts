import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stardesk.app',
  appName: 'Stardesk',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'gen-lang-client-0556493295.firebaseapp.com',
      '*.firebaseapp.com',
      '*.googleapis.com',
      '*.google.com',
      '*.gstatic.com'
    ]
  }
};

export default config;
