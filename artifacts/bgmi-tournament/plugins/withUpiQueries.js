const { withAndroidManifest } = require('expo/config-plugins');

const UPI_PACKAGES = [
  'com.phonepe.app',
  'com.google.android.apps.nbu.paisa.user',
  'net.one97.paytm',
];

function packageName(entry) {
  return entry?.$?.['android:name'];
}

module.exports = function withUpiQueries(config) {
  return withAndroidManifest(config, (configWithManifest) => {
    const manifest = configWithManifest.modResults.manifest;
    const queries = Array.isArray(manifest.queries) ? manifest.queries : [];
    const packageQuery = queries.find((query) => Array.isArray(query.package)) ?? queries[0];

    if (packageQuery) {
      packageQuery.package = Array.isArray(packageQuery.package) ? packageQuery.package : [];
      const existingNames = new Set(packageQuery.package.map(packageName));
      for (const name of UPI_PACKAGES) {
        if (!existingNames.has(name)) {
          packageQuery.package.push({ $: { 'android:name': name } });
        }
      }
    } else {
      queries.push({
        package: UPI_PACKAGES.map((name) => ({ $: { 'android:name': name } })),
      });
    }

    manifest.queries = queries;
    return configWithManifest;
  });
};