// iOS 27 refuses to launch apps that don't adopt the UIScene life cycle.
// Expo SDK 57 ships ExpoAppSceneDelegate but its prebuild template doesn't
// wire it up, so this plugin does: the scene delegate owns the window and
// starts React Native; the app delegate only creates the factory.
// ponytail: remove once Expo's prebuild template adopts scenes itself.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const WINDOW_STARTUP = /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)[\s\S]*?#endif\n/;

module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return config;
  });

  return withAppDelegate(config, (config) => {
    let src = config.modResults.contents;
    if (src.includes('ExpoReactNativeFactoryProvider')) return config;

    const declaration = 'class AppDelegate: ExpoAppDelegate {';
    if (!src.includes(declaration) || !WINDOW_STARTUP.test(src)) {
      throw new Error('withSceneLifecycle: AppDelegate.swift template changed; update the plugin.');
    }
    src = src
      .replace(declaration, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {')
      .replace(WINDOW_STARTUP, '\n    // ExpoAppSceneDelegate creates the window and starts React Native.\n');
    config.modResults.contents = src;
    return config;
  });
};
