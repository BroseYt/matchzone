import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
} from "react-native";

import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import * as ImagePicker from "expo-image-picker";

import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

import { auth } from "../services/firebase";
import {
  deleteCurrentAccount,
  usesPasswordSignIn,
} from "../services/accountDeletion";
import {
  getProfilePhoto,
  removeProfilePhoto,
  saveProfilePhoto,
} from "../services/profilePhoto";
import { useAppTheme } from "../context/ThemeContext";

export default function ProfileScreen() {
  const { theme, darkMode, toggleTheme } =
    useAppTheme();

  const styles =
    createStyles(theme);

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [user, setUser] =
    useState(null);

  const [profilePhoto, setProfilePhoto] =
    useState(null);

  const [hasCustomPhoto, setHasCustomPhoto] =
    useState(false);

  const [photoMenuVisible, setPhotoMenuVisible] =
    useState(false);

  const [photoUploading, setPhotoUploading] =
    useState(false);

  const [photoProgress, setPhotoProgress] =
    useState(0);

  const [loading, setLoading] =
    useState(false);

  const [deleteModalVisible, setDeleteModalVisible] =
    useState(false);
  const [deletePassword, setDeletePassword] =
    useState("");
  const [deleteLoading, setDeleteLoading] =
    useState(false);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {
          setUser(currentUser);

          if (!currentUser) {
            setProfilePhoto(null);
            setHasCustomPhoto(false);
            setPhotoMenuVisible(false);
            return;
          }

          const localPhoto =
            await getProfilePhoto(currentUser.uid);

          setProfilePhoto(
            localPhoto ||
              currentUser.photoURL ||
              null
          );
          setHasCustomPhoto(Boolean(localPhoto));
        }
      );

    return unsubscribe;
  }, []);

  async function handleLogin() {
    try {
      if (!email || !password) {
        Alert.alert(
          "Missing information",
          "Please enter email and password."
        );

        return;
      }

      setLoading(true);

      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      setEmail("");
      setPassword("");

      Alert.alert(
        "Success",
        "Logged in successfully."
      );
    } catch (error) {
      console.log(
        "LOGIN ERROR:",
        error
      );

      Alert.alert(
        "Login failed",
        error.message
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAccount() {
    try {
      if (!email || !password) {
        Alert.alert(
          "Missing information",
          "Please enter email and password."
        );

        return;
      }

      if (password.length < 6) {
        Alert.alert(
          "Weak password",
          "Password must be at least 6 characters."
        );

        return;
      }

      setLoading(true);

      await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      setEmail("");
      setPassword("");

      Alert.alert(
        "Account created",
        "Your account was created successfully."
      );
    } catch (error) {
      console.log(
        "SIGNUP ERROR:",
        error
      );

      Alert.alert(
        "Signup failed",
        error.message
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);

      Alert.alert(
        "Signed out",
        "You have been signed out."
      );
    } catch (error) {
      Alert.alert(
        "Sign out failed",
        error.message
      );
    }
  }

  async function handlePasswordReset() {
    const targetEmail = email.trim();

    if (!targetEmail) {
      Alert.alert(
        "Enter your email",
        "Type your account email first, then choose Forgot Password."
      );
      return;
    }

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      Alert.alert(
        "Reset email sent",
        "Check your inbox and spam folder for the password reset link."
      );
    } catch (error) {
      Alert.alert(
        "Reset failed",
        error.message || "A reset email could not be sent."
      );
    }
  }

  function showPermissionHelp(kind) {
    Alert.alert(
      `${kind} access needed`,
      `Allow ${kind.toLowerCase()} access in your device settings to update your profile picture.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Open Settings",
          onPress: () => Linking.openSettings(),
        },
      ]
    );
  }

  async function chooseProfilePhoto(source) {
    if (!user || photoUploading) return;

    setPhotoMenuVisible(false);

    try {
      if (source === "camera") {
        const permission =
          await ImagePicker.requestCameraPermissionsAsync();

        if (!permission.granted) {
          showPermissionHelp("Camera");
          return;
        }
      }

      const options = {
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.82,
        base64: Platform.OS === "web",
      };

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              ...options,
              cameraType: ImagePicker.CameraType.front,
            })
          : await ImagePicker.launchImageLibraryAsync(
              options
            );

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const previousPhoto = profilePhoto;

      setPhotoUploading(true);
      setPhotoProgress(0);
      setProfilePhoto(asset.uri);

      try {
        const photoUrl = await saveProfilePhoto(
          user.uid,
          asset,
          setPhotoProgress
        );

        setProfilePhoto(photoUrl);
        setHasCustomPhoto(true);
      } catch (error) {
        setProfilePhoto(previousPhoto);
        throw error;
      }
    } catch (error) {
      console.log("PROFILE PHOTO ERROR:", error);
      Alert.alert(
        "Photo update failed",
        error.message ||
          "Your profile picture could not be updated."
      );
    } finally {
      setPhotoUploading(false);
      setPhotoProgress(0);
    }
  }

  function confirmRemovePhoto() {
    setPhotoMenuVisible(false);

    Alert.alert(
      "Remove profile picture?",
      "Your account will return to the default avatar.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: handleRemovePhoto,
        },
      ]
    );
  }

  async function handleRemovePhoto() {
    if (!user || photoUploading) return;

    try {
      setPhotoUploading(true);
      await removeProfilePhoto(user.uid);
      setProfilePhoto(user.photoURL || null);
      setHasCustomPhoto(false);
    } catch (error) {
      console.log("PROFILE PHOTO REMOVE ERROR:", error);
      Alert.alert(
        "Could not remove photo",
        error.message ||
          "Your profile picture could not be removed."
      );
    } finally {
      setPhotoUploading(false);
      setPhotoProgress(0);
    }
  }

  function openDeleteAccount() {
    setDeletePassword("");
    setDeleteModalVisible(true);
  }

  async function handleDeleteAccount() {
    try {
      setDeleteLoading(true);
      await deleteCurrentAccount(deletePassword);
      setDeleteModalVisible(false);
      setDeletePassword("");

      Alert.alert(
        "Account deleted",
        "Your MatchZone account and associated app data were permanently deleted."
      );
    } catch (error) {
      console.log("ACCOUNT DELETE ERROR:", error);

      const requiresRecentLogin =
        error?.code === "auth/requires-recent-login";

      Alert.alert(
        "Account could not be deleted",
        requiresRecentLogin
          ? "Sign out, sign in again, and immediately retry account deletion."
          : error.message ||
              "Your account could not be deleted. Please try again."
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() =>
            router.back()
          }
        >
          <Ionicons
            name="chevron-back"
            size={28}
            color={theme.text}
          />
        </Pressable>

        <Text style={styles.title}>
          Profile
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={styles.profileCard}
        >
          <Pressable
            style={styles.avatarButton}
            onPress={() =>
              user &&
              setPhotoMenuVisible(true)
            }
            disabled={!user || photoUploading}
          >
            <View style={styles.avatar}>
              {profilePhoto ? (
                <Image
                  source={{ uri: profilePhoto }}
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons
                  name={
                    user
                      ? "person"
                      : "person-outline"
                  }
                  size={46}
                  color={theme.accent}
                />
              )}

              {photoUploading ? (
                <View style={styles.avatarLoading}>
                  <ActivityIndicator
                    color={theme.onDanger}
                  />
                </View>
              ) : null}
            </View>

            {user ? (
              <View style={styles.cameraBadge}>
                <Ionicons
                  name="camera"
                  size={17}
                  color={theme.onAccent}
                />
              </View>
            ) : null}
          </Pressable>

          <Text
            style={styles.profileName}
          >
            {user
              ? user.displayName ||
                user.email?.split("@")[0] ||
                "MatchZone User"
              : "Guest User"}
          </Text>

          <Text
            style={styles.profileSub}
          >
            {user?.email ||
              "Sign in to join Fan Rooms and manage your account"}
          </Text>

          {user ? (
            <Text style={styles.photoHint}>
              Tap the photo to change it
            </Text>
          ) : null}

          {photoUploading ? (
            <View style={styles.uploadBlock}>
              <View style={styles.uploadTrack}>
                <View
                  style={[
                    styles.uploadFill,
                    {
                      width: `${Math.max(
                        4,
                        Math.round(photoProgress * 100)
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.uploadText}>
                Uploading photo{" "}
                {Math.round(photoProgress * 100)}%
              </Text>
            </View>
          ) : null}

          {user ? (
            <Pressable
              style={
                styles.signOutBtn
              }
              onPress={
                handleSignOut
              }
            >
              <Ionicons
                name="log-out"
                size={22}
                color="white"
              />

              <Text
                style={
                  styles.signOutText
                }
              >
                Sign Out
              </Text>
            </Pressable>
          ) : (
            <>
              <TextInput
                placeholder="Email"
                placeholderTextColor={
                  theme.subText
                }
                value={email}
                onChangeText={
                  setEmail
                }
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TextInput
                placeholder="Password"
                placeholderTextColor={
                  theme.subText
                }
                value={password}
                onChangeText={
                  setPassword
                }
                style={styles.input}
                secureTextEntry
              />

              <Pressable
                style={
                  styles.loginBtn
                }
                onPress={
                  handleLogin
                }
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={theme.onAccent} />
                ) : (
                  <>
                    <Ionicons
                      name="mail"
                      size={22}
                      color={theme.onAccent}
                    />

                    <Text
                      style={
                        styles.loginText
                      }
                    >
                      Login with Email
                    </Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={
                  styles.createBtn
                }
                onPress={
                  handleCreateAccount
                }
              >
                <Text
                  style={
                    styles.createText
                  }
                >
                  Create New Account
                </Text>
              </Pressable>

              <Pressable
                style={styles.resetButton}
                onPress={handlePasswordReset}
              >
                <Text style={styles.resetText}>
                  Forgot Password?
                </Text>
              </Pressable>

              <Text style={styles.accountNotice}>
                By creating an account, you agree to the Terms and
                acknowledge the Privacy Policy.
              </Text>
            </>
          )}
        </View>

        <Text style={styles.section}>
          App Settings
        </Text>

        <SettingRow
          icon="notifications"
          title="Notification Center"
          subtitle="Goal alerts, live match alerts and updates"
          theme={theme}
          onPress={() =>
            router.push(
              "/notifications"
            )
          }
        />

        <View
          style={styles.settingCard}
        >
          <View
            style={
              styles.settingLeft
            }
          >
            <Ionicons
              name="moon"
              size={22}
              color={theme.accent}
            />

            <View
              style={{
                marginLeft: 14,
              }}
            >
              <Text
                style={
                  styles.settingTitle
                }
              >
                Dark Mode
              </Text>

              <Text
                style={
                  styles.settingSub
                }
              >
                Switch app appearance
              </Text>
            </View>
          </View>

          <Switch
            value={darkMode}
            onValueChange={
              toggleTheme
            }
            thumbColor={
              theme.accent
            }
          />
        </View>

        <SettingRow
          icon="chatbox-ellipses"
          title="Send Feedback"
          subtitle="Report bugs or suggest features"
          theme={theme}
          onPress={() =>
            router.push(
              "/feedback"
            )
          }
        />

        <SettingRow
          icon="information-circle"
          title="App Version"
          subtitle="MatchZone v1.0.0"
          theme={theme}
        />

        <SettingRow
          icon="server-outline"
          title="Data Attribution"
          subtitle="Football information from football-data.org, API-Football and ESPN. News links from BBC Sport and Sky Sports. Flags through FlagCDN."
          theme={theme}
        />

        <View
          style={{ height: 80 }}
        />

        <Text style={styles.section}>
          Account & Privacy
        </Text>

        <SettingRow
          icon="shield-checkmark-outline"
          title="Privacy Policy"
          subtitle="How MatchZone handles data"
          theme={theme}
          onPress={() =>
            router.push("/legal/privacy")
          }
        />

        <SettingRow
          icon="document-text-outline"
          title="Terms & Community Rules"
          subtitle="Rules for accounts and Fan Rooms"
          theme={theme}
          onPress={() =>
            router.push("/legal/terms")
          }
        />

        <SettingRow
          icon="person-remove-outline"
          title="Account Deletion Help"
          subtitle="What is deleted and how to request it"
          theme={theme}
          onPress={() =>
            router.push("/legal/deletion")
          }
        />

        {user ? (
          <Pressable
            style={styles.deleteAccountCard}
            onPress={openDeleteAccount}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name="trash-outline"
                size={22}
                color={theme.danger}
              />
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={styles.deleteAccountTitle}>
                  Delete Account
                </Text>
                <Text style={styles.settingSub}>
                  Permanently delete your account and associated data
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.danger}
            />
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal
        visible={photoMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setPhotoMenuVisible(false)
        }
      >
        <Pressable
          style={styles.photoOverlay}
          onPress={() =>
            setPhotoMenuVisible(false)
          }
        >
          <Pressable
            style={styles.photoSheet}
            onPress={(event) =>
              event.stopPropagation()
            }
          >
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>
              Profile picture
            </Text>

            <Text style={styles.sheetSubtitle}>
              Choose a clear square photo. It is saved privately on this device.
            </Text>

            <PhotoAction
              icon="camera-outline"
              title="Take a photo"
              subtitle="Use your front camera"
              onPress={() =>
                chooseProfilePhoto("camera")
              }
              styles={styles}
              theme={theme}
            />

            <PhotoAction
              icon="images-outline"
              title="Choose from photos"
              subtitle="Select an existing picture"
              onPress={() =>
                chooseProfilePhoto("library")
              }
              styles={styles}
              theme={theme}
            />

            {hasCustomPhoto ? (
              <PhotoAction
                icon="trash-outline"
                title="Remove current photo"
                subtitle="Use the default MatchZone avatar"
                onPress={confirmRemovePhoto}
                styles={styles}
                theme={theme}
                destructive
              />
            ) : null}

            <Pressable
              style={styles.cancelPhotoButton}
              onPress={() =>
                setPhotoMenuVisible(false)
              }
            >
              <Text style={styles.cancelPhotoText}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          !deleteLoading && setDeleteModalVisible(false)
        }
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteDialog}>
            <View style={styles.deleteIcon}>
              <Ionicons
                name="warning-outline"
                size={28}
                color={theme.danger}
              />
            </View>
            <Text style={styles.deleteTitle}>
              Delete your account?
            </Text>
            <Text style={styles.deleteBody}>
              This permanently removes your account, Fan Room activity,
              reports, blocks, signed-in feedback and local profile picture.
              This cannot be undone.
            </Text>

            {usesPasswordSignIn(user) ? (
              <TextInput
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder="Confirm your password"
                placeholderTextColor={theme.subText}
                secureTextEntry
                style={styles.deleteInput}
                editable={!deleteLoading}
              />
            ) : null}

            <Pressable
              style={styles.confirmDeleteButton}
              onPress={handleDeleteAccount}
              disabled={deleteLoading}
            >
              {deleteLoading ? (
                <ActivityIndicator color={theme.onDanger} />
              ) : (
                <Text style={styles.confirmDeleteText}>
                  Permanently Delete Account
                </Text>
              )}
            </Pressable>
            <Pressable
              style={styles.cancelDeleteButton}
              onPress={() => setDeleteModalVisible(false)}
              disabled={deleteLoading}
            >
              <Text style={styles.cancelDeleteText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PhotoAction({
  icon,
  title,
  subtitle,
  onPress,
  styles,
  theme,
  destructive = false,
}) {
  const color = destructive
    ? theme.danger
    : theme.accent;

  return (
    <Pressable
      style={styles.photoAction}
      onPress={onPress}
    >
      <View
        style={[
          styles.photoActionIcon,
          destructive &&
            styles.photoActionIconDanger,
        ]}
      >
        <Ionicons
          name={icon}
          size={22}
          color={color}
        />
      </View>

      <View style={styles.photoActionCopy}>
        <Text
          style={[
            styles.photoActionTitle,
            destructive && {
              color: theme.danger,
            },
          ]}
        >
          {title}
        </Text>

        <Text style={styles.photoActionSubtitle}>
          {subtitle}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color={theme.subText}
      />
    </Pressable>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  onPress,
  theme,
}) {
  const styles =
    createStyles(theme);

  return (
    <Pressable
      style={styles.settingCard}
      onPress={onPress}
    >
      <View
        style={styles.settingLeft}
      >
        <Ionicons
          name={icon}
          size={22}
          color={theme.accent}
        />

        <View
          style={{
            marginLeft: 14,
          }}
        >
          <Text
            style={
              styles.settingTitle
            }
          >
            {title}
          </Text>

          <Text
            style={
              styles.settingSub
            }
          >
            {subtitle}
          </Text>
        </View>
      </View>

      {onPress && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={theme.subText}
        />
      )}
    </Pressable>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        theme.background,
      paddingTop: 55,
      paddingHorizontal: 14,
    },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 24,
    },

    backBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor:
        theme.card,
      justifyContent:
        "center",
      alignItems: "center",
      marginRight: 14,
    },

    title: {
      color: theme.text,
      fontSize: 28,
      fontWeight: "bold",
    },

    profileCard: {
      backgroundColor:
        theme.card,
      borderRadius: 24,
      padding: 24,
      alignItems: "center",
      borderWidth: 1,
      borderColor:
        theme.border,
      marginBottom: 26,
    },

    avatarButton: {
      position: "relative",
      marginBottom: 16,
    },

    avatar: {
      width: 104,
      height: 104,
      borderRadius: 52,
      backgroundColor:
        theme.cardAlt,
      justifyContent:
        "center",
      alignItems: "center",
      overflow: "hidden",
      borderWidth: 2,
      borderColor: theme.border,
    },

    avatarImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },

    avatarLoading: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.overlay,
      justifyContent: "center",
      alignItems: "center",
    },

    cameraBadge: {
      position: "absolute",
      right: -2,
      bottom: 2,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.accent,
      borderWidth: 3,
      borderColor: theme.card,
      justifyContent: "center",
      alignItems: "center",
    },

    profileName: {
      color: theme.text,
      fontSize: 22,
      fontWeight: "bold",
    },

    profileSub: {
      color: theme.subText,
      marginTop: 8,
      textAlign: "center",
    },

    photoHint: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 7,
    },

    uploadBlock: {
      width: "100%",
      marginTop: 16,
    },

    uploadTrack: {
      height: 6,
      borderRadius: 3,
      overflow: "hidden",
      backgroundColor: theme.cardAlt,
    },

    uploadFill: {
      height: "100%",
      borderRadius: 3,
      backgroundColor: theme.accent,
    },

    uploadText: {
      color: theme.subText,
      fontSize: 10,
      textAlign: "center",
      marginTop: 6,
    },

    input: {
      backgroundColor:
        theme.cardAlt,
      color: theme.text,
      width: "100%",
      height: 52,
      borderRadius: 16,
      paddingHorizontal: 16,
      marginTop: 14,
      borderWidth: 1,
      borderColor:
        theme.border,
    },

    loginBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        theme.accent,
      width: "100%",
      paddingVertical: 14,
      borderRadius: 30,
      marginTop: 18,
    },

    loginText: {
      color: theme.onAccent,
      fontWeight: "bold",
      marginLeft: 10,
    },

    createBtn: {
      marginTop: 14,
    },

    createText: {
      color: theme.accent,
      fontWeight: "bold",
    },

    resetButton: {
      marginTop: 15,
    },

    resetText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: "700",
    },

    accountNotice: {
      color: theme.subText,
      fontSize: 10,
      lineHeight: 16,
      textAlign: "center",
      marginTop: 18,
    },

    divider: {
      height: 1,
      backgroundColor:
        theme.border,
      width: "100%",
      marginVertical: 22,
    },

    disabledBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        theme.cardAlt,
      width: "100%",
      paddingVertical: 14,
      borderRadius: 30,
      justifyContent:
        "center",
      marginBottom: 12,
      borderWidth: 1,
      borderColor:
        theme.border,
    },

    disabledText: {
      color: theme.text,
      fontWeight: "bold",
      marginLeft: 10,
    },

    signOutBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        theme.danger,
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 30,
      marginTop: 22,
    },

    signOutText: {
      color: "white",
      fontWeight: "bold",
      marginLeft: 10,
    },

    photoOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      justifyContent: "flex-end",
    },

    photoSheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 28,
      borderWidth: 1,
      borderColor: theme.border,
    },

    sheetHandle: {
      width: 42,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.border,
      alignSelf: "center",
      marginBottom: 18,
    },

    sheetTitle: {
      color: theme.text,
      fontSize: 23,
      fontWeight: "900",
    },

    sheetSubtitle: {
      color: theme.subText,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 6,
      marginBottom: 16,
    },

    photoAction: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },

    photoActionIcon: {
      width: 44,
      height: 44,
      borderRadius: 15,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.cardAlt,
    },

    photoActionIconDanger: {
      backgroundColor: theme.isDark
        ? "rgba(239,68,68,0.14)"
        : "rgba(220,38,38,0.09)",
    },

    photoActionCopy: {
      flex: 1,
      marginLeft: 13,
    },

    photoActionTitle: {
      color: theme.text,
      fontWeight: "800",
    },

    photoActionSubtitle: {
      color: theme.subText,
      fontSize: 11,
      marginTop: 3,
    },

    cancelPhotoButton: {
      backgroundColor: theme.cardAlt,
      borderRadius: 17,
      alignItems: "center",
      paddingVertical: 14,
      marginTop: 18,
    },

    cancelPhotoText: {
      color: theme.text,
      fontWeight: "800",
    },

    section: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 14,
    },

    settingCard: {
      backgroundColor:
        theme.card,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor:
        theme.border,
      marginBottom: 14,
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
    },

    settingLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },

    settingTitle: {
      color: theme.text,
      fontWeight: "bold",
    },

    settingSub: {
      color: theme.subText,
      fontSize: 12,
      marginTop: 4,
    },

    deleteAccountCard: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.danger,
      marginBottom: 14,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    deleteAccountTitle: {
      color: theme.danger,
      fontWeight: "900",
    },

    deleteOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      justifyContent: "center",
      paddingHorizontal: 20,
    },

    deleteDialog: {
      backgroundColor: theme.card,
      borderRadius: 25,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 21,
    },

    deleteIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.cardAlt,
      alignItems: "center",
      justifyContent: "center",
    },

    deleteTitle: {
      color: theme.text,
      fontSize: 21,
      fontWeight: "900",
      marginTop: 15,
    },

    deleteBody: {
      color: theme.subText,
      fontSize: 12,
      lineHeight: 19,
      marginTop: 8,
    },

    deleteInput: {
      backgroundColor: theme.cardAlt,
      color: theme.text,
      height: 50,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      marginTop: 16,
    },

    confirmDeleteButton: {
      backgroundColor: theme.danger,
      borderRadius: 17,
      minHeight: 49,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 17,
    },

    confirmDeleteText: {
      color: theme.onDanger,
      fontWeight: "900",
    },

    cancelDeleteButton: {
      alignItems: "center",
      paddingVertical: 14,
    },

    cancelDeleteText: {
      color: theme.text,
      fontWeight: "800",
    },
  });
}
