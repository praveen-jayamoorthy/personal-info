import FontAwesome from "@expo/vector-icons/FontAwesome";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { router, Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/components/useColorScheme";
import { useAuthStore } from "@/store/authStore";
import { StatusBar } from "expo-status-bar";
import AppHeader from "./AppHeader";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

const HIDDEN_ROUTES = ["/login"]; // add any other screens here

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, initializing, isRegistered, _init } = useAuthStore();

  useEffect(() => {
    return _init();
  }, [_init]);

  useEffect(() => {
    if (initializing) {
      return;
    }

    if (!user) {
      router.replace("/index");
      return;
    }

    if (isRegistered === false) {
      router.replace("/register");
      return;
    }

    if (isRegistered === true) {
      router.replace("/(tabs)");
    }
  }, [initializing, isRegistered, user]);
  const pathname = usePathname();
  const hideHeader = HIDDEN_ROUTES.includes(pathname);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      {hideHeader && <AppHeader />}
      <Stack screenOptions={{ headerShown: false }}>
        {user && isRegistered === true && <Stack.Screen name="(tabs)" />}
        {user && isRegistered === false && <Stack.Screen name="register" />}
        {!user && <Stack.Screen name="index" />}
      </Stack>

      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
