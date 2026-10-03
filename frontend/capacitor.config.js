const { CapacitorConfig } = require("@capacitor/cli");

const config = {
  appId: "pt.lusorae.crime",
  appName: "Lusorae",
  webDir: "build",
  server: {
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#050505",
  },
  plugins: {
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
      logLevel: 0,
    },
  },
};

module.exports = config;
