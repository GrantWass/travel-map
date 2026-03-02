import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createUser, loginUser } from "@/src/api/client";
import { setAuthToken } from "@/src/api/auth-token";
import { APP_NAME } from "@/src/constants/trip";
import { colors } from "@/src/constants/theme";
import { useAuth } from "@/src/hooks/use-auth";
import type { SessionUser } from "@/src/types/api";

type AccountType = "traveler" | "student";
type AuthMode = "signup" | "signin";

export default function SignInScreen() {
  const router = useRouter();
  const { setAuthenticatedUser, refreshMyProfile } = useAuth();

  const [mode, setMode] = useState<AuthMode>("signup");
  const [accountType, setAccountType] = useState<AccountType>("traveler");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignup = mode === "signup";

  const subtitle = useMemo(() => {
    if (!isSignup) {
      return "Enter your email and password to continue.";
    }

    return accountType === "student"
      ? "Post trips and pop-ups for your classmates."
      : "Explore authentic trips and save plans from real travelers.";
  }, [accountType, isSignup]);

  async function loginWithCredentials(nextEmail: string, nextPassword: string): Promise<SessionUser | null> {
    const response = await loginUser({ email: nextEmail, password: nextPassword });

    if (response?.auth_token) {
      await setAuthToken(response.auth_token);
    }

    if (!response?.user?.user_id) {
      setError("Login succeeded but user session data is missing.");
      return null;
    }

    return response.user;
  }

  async function handleSubmit() {
    setError("");
    setIsSubmitting(true);

    try {
      if (isSignup) {
        if (!name.trim()) {
          setError("Name is required.");
          return;
        }

        const createResponse = await createUser({
          name: name.trim(),
          email: email.trim(),
          password,
        });

        if (createResponse.auth_token) {
          await setAuthToken(createResponse.auth_token);
        }

        const loggedInUser = await loginWithCredentials(email.trim(), password);
        if (!loggedInUser) {
          return;
        }

        await setAuthenticatedUser(loggedInUser);
        await refreshMyProfile(loggedInUser.user_id);

        router.replace(`/profile-setup?accountType=${accountType}`);
        return;
      }

      const loggedInUser = await loginWithCredentials(email.trim(), password);
      if (!loggedInUser) {
        return;
      }

      await setAuthenticatedUser(loggedInUser);
      await refreshMyProfile(loggedInUser.user_id);

      router.replace("/map");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Could not reach server.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.brandName}>{APP_NAME}</Text>
          <Text style={styles.title}>{isSignup ? "You are a" : "Welcome back"}</Text>

          {isSignup ? (
            <View style={styles.accountTypeRow}>
              <Pressable
                onPress={() => setAccountType("traveler")}
                style={[styles.accountTypeButton, accountType === "traveler" && styles.accountTypeButtonActive]}
              >
                <Text
                  style={[
                    styles.accountTypeText,
                    accountType === "traveler" && styles.accountTypeTextActive,
                  ]}
                >
                  Traveler
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setAccountType("student")}
                style={[styles.accountTypeButton, accountType === "student" && styles.accountTypeButtonActive]}
              >
                <Text
                  style={[
                    styles.accountTypeText,
                    accountType === "student" && styles.accountTypeTextActive,
                  ]}
                >
                  Student
                </Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.form}>
            {isSignup ? (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                autoCapitalize="words"
                style={styles.input}
              />
            ) : null}

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={isSignup && accountType === "student" ? "University email (.edu)" : "Email"}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              style={styles.input}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={() => {
                void handleSubmit();
              }}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && !isSubmitting && styles.submitButtonPressed,
                isSubmitting && styles.submitButtonDisabled,
              ]}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? "Please wait..." : isSignup ? "Get started" : "Sign in"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.switchRow}>
            {isSignup ? (
              <>
                <Text style={styles.switchText}>Already have an account?</Text>
                <Pressable
                  onPress={() => {
                    setMode("signin");
                    setError("");
                  }}
                >
                  <Text style={styles.switchAction}>Sign in</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.switchText}>New here?</Text>
                <Pressable
                  onPress={() => {
                    setMode("signup");
                    setError("");
                  }}
                >
                  <Text style={styles.switchAction}>Create an account</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    paddingVertical: 32,
  },
  brandName: {
    fontSize: 34,
    fontWeight: "700",
    color: colors.primaryDark,
    marginBottom: 18,
    textAlign: "center",
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: "800",
    textAlign: "center",
  },
  accountTypeRow: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  accountTypeButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  accountTypeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  accountTypeText: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "600",
  },
  accountTypeTextActive: {
    color: colors.primaryDark,
  },
  subtitle: {
    marginTop: 10,
    textAlign: "center",
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
  },
  form: {
    marginTop: 26,
    gap: 12,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
  submitButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  submitButtonPressed: {
    opacity: 0.9,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  switchRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  switchText: {
    color: colors.mutedText,
    fontSize: 13,
  },
  switchAction: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },
});
