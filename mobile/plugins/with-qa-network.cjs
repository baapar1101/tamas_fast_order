const { withAndroidManifest, withAppBuildGradle } = require("expo/config-plugins");
module.exports = (config) => {
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application[0];
    // Only the explicitly named QA flavor can use the loopback test transport.
    application.$["android:usesCleartextTraffic"] = process.env.EXPO_PUBLIC_TAMAS_QA === "true" ? "true" : "false";
    return mod;
  });
  return withAppBuildGradle(config, (mod) => {
    // Gradle does not otherwise treat EXPO_PUBLIC variables as bundle inputs.
    // Switching flavor must rebuild JS, even when every source file is unchanged.
    if (!mod.modResults.contents.includes('inputs.property("tamasQaBuild"')) {
      mod.modResults.contents += `
tasks.withType(com.facebook.react.tasks.BundleHermesCTask).configureEach {
    inputs.property("tamasQaBuild", System.getenv("EXPO_PUBLIC_TAMAS_QA") ?: "false")
}
`;
    }
    if (!mod.modResults.contents.includes('extraPackagerArgs = ["--reset-cache"]')) {
      mod.modResults.contents = mod.modResults.contents.replace('bundleCommand = "export:embed"', 'bundleCommand = "export:embed"\n    extraPackagerArgs = ["--reset-cache"]');
    }
    return mod;
  });
};
