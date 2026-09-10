This is the source code for implementing phone auth using expo + firebase: [source code](https://youtu.be/dLk70d9TSlI)

Packages installed:
npx expo install @react-native-firebase/app @react-native-firebase/auth expo-build-properties

npx expo prebuild --clean

npx expo prebuild
npx expo run:android

// for generating the apk locally
npx expo prebuild -p android
cd android
gradlew assembleRelease


// bundle build
npx expo export:embed --platform android --dev false --entry-file node_modules/expo-router/entry.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res