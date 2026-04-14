import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stardesk.app',
  appName: 'Stardesk',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'stardesk.app'
  }
};

export default config;
