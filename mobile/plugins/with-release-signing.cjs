const { withAppBuildGradle } = require("expo/config-plugins");
module.exports = (config) =>
  withAppBuildGradle(config, (mod) => {
    if (mod.modResults.contents.includes("def tamasSigningReady")) return mod;
    const signing = `
    // Signing material is supplied only by the local build environment, never source control.
    def tamasSigningReady = System.getenv('TAMAS_KEYSTORE') != null
    if (gradle.startParameter.taskNames.any { it.toLowerCase().contains('release') } && !tamasSigningReady) {
        throw new GradleException('Release signing credentials are required; debug-signed releases are forbidden.')
    }
    if (tamasSigningReady) {
        signingConfigs {
            tamasRelease {
                storeFile file(System.getenv('TAMAS_KEYSTORE'))
                storePassword System.getenv('TAMAS_STORE_PASSWORD')
                keyAlias System.getenv('TAMAS_KEY_ALIAS')
                keyPassword System.getenv('TAMAS_KEY_PASSWORD')
            }
        }
    }
`;
    mod.modResults.contents = mod.modResults.contents
      .replace("    buildTypes {", `${signing}\n    buildTypes {`)
      .replace(
        /(release\s*\{[\s\S]*?)signingConfig signingConfigs.debug/,
        "$1signingConfig tamasSigningReady ? signingConfigs.tamasRelease : signingConfigs.debug",
      );
    return mod;
  });
