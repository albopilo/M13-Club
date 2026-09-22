import {
  useEffect,
} from "react";

import {
  Stack,
} from "expo-router";

import {
  StatusBar,
} from "expo-status-bar";

import {
  useFonts,
} from "expo-font";

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
} from "@expo-google-fonts/playfair-display";

import * as SplashScreen from "expo-splash-screen";

import {
  useFrameworkReady,
} from "@/hooks/useFrameworkReady";

import {
  AuthProvider,
} from "@/context/AuthContext";

import {
  LanguageProvider,
} from "@/context/LanguageContext";

import * as WebBrowser from "expo-web-browser";

/**
 * Complete pending Expo AuthSession browser flows.
 *
 * Keep this at the root of the application.
 */
WebBrowser.maybeCompleteAuthSession();

/**
 * Keep the splash screen visible until
 * fonts are ready.
 */
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useFrameworkReady();

  const [
    fontsLoaded,
    fontError,
  ] = useFonts({
    "Inter-Regular":
      Inter_400Regular,

    "Inter-Medium":
      Inter_500Medium,

    "Inter-SemiBold":
      Inter_600SemiBold,

    "Inter-Bold":
      Inter_700Bold,

    "PlayfairDisplay-Regular":
      PlayfairDisplay_400Regular,

    "PlayfairDisplay-Bold":
      PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    if (
      fontsLoaded ||
      fontError
    ) {
      SplashScreen.hideAsync();
    }
  }, [
    fontsLoaded,
    fontError,
  ]);

  if (
    !fontsLoaded &&
    !fontError
  ) {
    return null;
  }

  return (
    <AuthProvider>
      <LanguageProvider>
        <Stack
        screenOptions={{
          headerShown:
            false,
        }}
      >
        <Stack.Screen
          name="(auth)"
          options={{
            headerShown:
              false,
          }}
        />

        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown:
              false,
          }}
        />

        <Stack.Screen
          name="admin"
          options={{
            headerShown:
              false,
          }}
        />

        <Stack.Screen
          name="promo"
          options={{
            headerShown:
              false,
          }}
        />

        <Stack.Screen
          name="+not-found"
        />
      </Stack>

      <StatusBar
        style="light"
      />
      </LanguageProvider>
    </AuthProvider>
  );
}