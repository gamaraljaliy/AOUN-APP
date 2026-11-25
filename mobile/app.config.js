// Android standalone builds use Google Maps. Expo Go supplies its own key.
module.exports = ({ config }) => {
  const apiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  if (!apiKey) return config;
  return {
    ...config,
    android: {
      ...config.android,
      config: { ...config.android?.config, googleMaps: { apiKey } },
    },
  };
};
