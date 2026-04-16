import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stardesk.app',
  appName: 'Stardesk',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '280421462655-s14le5n9gjtduqf7iaqltjr0c99iurnh.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
