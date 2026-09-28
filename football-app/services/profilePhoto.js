import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

const PROFILE_PHOTO_KEY_PREFIX =
  "matchzone_profile_photo_v1";
const MAX_PROFILE_PHOTO_BYTES = 8 * 1024 * 1024;

function storageKey(userId) {
  return `${PROFILE_PHOTO_KEY_PREFIX}:${userId}`;
}

function fileExtension(asset) {
  const fromName = asset?.fileName
    ?.split(".")
    .pop()
    ?.toLowerCase();

  if (["jpg", "jpeg", "png", "webp"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  if (asset?.mimeType === "image/png") return "png";
  if (asset?.mimeType === "image/webp") return "webp";
  return "jpg";
}

export async function getProfilePhoto(userId) {
  if (!userId) return null;

  try {
    const saved = await AsyncStorage.getItem(
      storageKey(userId)
    );

    if (!saved) return null;

    if (
      Platform.OS !== "web" &&
      saved.startsWith("file:")
    ) {
      const info = await FileSystem.getInfoAsync(saved);

      if (!info.exists) {
        await AsyncStorage.removeItem(storageKey(userId));
        return null;
      }
    }

    return saved;
  } catch (error) {
    console.log("PROFILE PHOTO LOAD ERROR:", error);
    return null;
  }
}

export async function saveProfilePhoto(
  userId,
  asset,
  onProgress
) {
  if (!userId) {
    throw new Error("You must be signed in to change your photo.");
  }

  if (
    Number.isFinite(asset?.fileSize) &&
    asset.fileSize > MAX_PROFILE_PHOTO_BYTES
  ) {
    throw new Error("Choose an image smaller than 8 MB.");
  }

  onProgress?.(0.15);

  let savedUri;

  if (Platform.OS === "web") {
    if (!asset?.base64) {
      throw new Error("The selected image could not be saved locally.");
    }

    savedUri = `data:${
      asset.mimeType || "image/jpeg"
    };base64,${asset.base64}`;

    if (savedUri.length > 4_000_000) {
      throw new Error(
        "This image is too large for browser storage. Choose a smaller photo."
      );
    }
  } else {
    const directory =
      `${FileSystem.documentDirectory}profile-pictures`;

    await FileSystem.makeDirectoryAsync(directory, {
      intermediates: true,
    });

    const extension = fileExtension(asset);
    savedUri = `${directory}/${userId}.${extension}`;

    const previous = await getProfilePhoto(userId);

    if (previous?.startsWith("file:")) {
      await FileSystem.deleteAsync(previous, {
        idempotent: true,
      });
    }

    await FileSystem.deleteAsync(savedUri, {
      idempotent: true,
    });

    await FileSystem.copyAsync({
      from: asset.uri,
      to: savedUri,
    });
  }

  onProgress?.(0.85);

  await AsyncStorage.setItem(
    storageKey(userId),
    savedUri
  );

  onProgress?.(1);
  return savedUri;
}

export async function removeProfilePhoto(userId) {
  if (!userId) {
    throw new Error("You must be signed in to remove your photo.");
  }

  const saved = await getProfilePhoto(userId);

  if (
    Platform.OS !== "web" &&
    saved?.startsWith("file:")
  ) {
    await FileSystem.deleteAsync(saved, {
      idempotent: true,
    });
  }

  await AsyncStorage.removeItem(storageKey(userId));
}
