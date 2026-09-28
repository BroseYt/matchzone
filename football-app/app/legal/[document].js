import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import {
  ACCOUNT_DELETION_URL,
  APP_NAME,
  LEGAL_EFFECTIVE_DATE,
  PRIVACY_URL,
  SUPPORT_EMAIL,
  TERMS_URL,
  privacySections,
  termsSections,
} from "../../constants/legal";
import { useAppTheme } from "../../context/ThemeContext";

const documents = {
  privacy: {
    title: "Privacy Policy",
    intro:
      "This policy explains how MatchZone handles information in the app.",
    sections: privacySections,
    webUrl: PRIVACY_URL,
  },
  terms: {
    title: "Terms & Community Rules",
    intro:
      "These terms apply when you use MatchZone, including its Fan Rooms.",
    sections: termsSections,
    webUrl: TERMS_URL,
  },
  deletion: {
    title: "Account Deletion",
    intro:
      "Signed-in users can permanently delete their account from the Profile screen.",
    sections: [
      {
        title: "Delete inside the app",
        body:
          "Open Profile, scroll to Account & Privacy, choose Delete Account, confirm your password when requested, and approve permanent deletion.",
      },
      {
        title: "Delete without the app",
        body: `Open the public deletion page or email ${SUPPORT_EMAIL} from the address connected to your MatchZone account. Include the subject "MatchZone account deletion".`,
      },
      {
        title: "What is deleted",
        body:
          "The Firebase account, fan-room messages, votes, reports, blocks, signed-in feedback and the local profile picture are removed. Device-only settings and cached public football data can be removed by clearing the app's storage or uninstalling it.",
      },
    ],
    webUrl: ACCOUNT_DELETION_URL,
  },
};

export default function LegalDocumentScreen() {
  const { document } = useLocalSearchParams();
  const { theme } = useAppTheme();
  const styles = createStyles(theme);
  const content = documents[document] || documents.privacy;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={27} color={theme.text} />
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.date}>Effective {LEGAL_EFFECTIVE_DATE}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Ionicons
            name="shield-checkmark-outline"
            size={30}
            color={theme.accent}
          />
          <Text style={styles.heroTitle}>{APP_NAME}</Text>
          <Text style={styles.intro}>{content.intro}</Text>
        </View>

        {content.sections.map((section) => (
          <View key={section.title} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}

        <Pressable
          style={styles.webButton}
          onPress={() => Linking.openURL(content.webUrl)}
        >
          <Ionicons name="globe-outline" size={20} color={theme.onAccent} />
          <Text style={styles.webButtonText}>Open public web version</Text>
        </Pressable>

        <Pressable
          style={styles.contactButton}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        >
          <Text style={styles.contactText}>{SUPPORT_EMAIL}</Text>
        </Pressable>
        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingTop: 52,
      paddingHorizontal: 14,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 18,
    },
    backButton: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 13,
    },
    titleBlock: {
      flex: 1,
    },
    title: {
      color: theme.text,
      fontSize: 23,
      fontWeight: "900",
    },
    date: {
      color: theme.subText,
      fontSize: 10,
      marginTop: 3,
    },
    hero: {
      backgroundColor: theme.card,
      borderRadius: 23,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 19,
      marginBottom: 13,
    },
    heroTitle: {
      color: theme.text,
      fontSize: 19,
      fontWeight: "900",
      marginTop: 10,
    },
    intro: {
      color: theme.subText,
      lineHeight: 20,
      marginTop: 7,
    },
    sectionCard: {
      backgroundColor: theme.card,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      marginBottom: 11,
    },
    sectionTitle: {
      color: theme.text,
      fontWeight: "900",
      fontSize: 15,
    },
    sectionBody: {
      color: theme.subText,
      fontSize: 12,
      lineHeight: 19,
      marginTop: 7,
    },
    webButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.accent,
      borderRadius: 18,
      paddingVertical: 14,
      marginTop: 5,
    },
    webButtonText: {
      color: theme.onAccent,
      fontWeight: "900",
      marginLeft: 8,
    },
    contactButton: {
      alignItems: "center",
      paddingVertical: 16,
    },
    contactText: {
      color: theme.accent,
      fontWeight: "800",
    },
    bottomSpace: {
      height: 45,
    },
  });
}
