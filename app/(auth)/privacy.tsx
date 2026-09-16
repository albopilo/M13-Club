import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";

import {
  PRIVACY_TITLE,
  PRIVACY_VERSION,
  PRIVACY_LAST_UPDATED,
  PRIVACY_SECTIONS,
} from "@/content/privacy-policy";

import { Colors, FontFamily } from "@/constants/theme";
import { useLanguage } from "@/context/LanguageContext";

export default function PrivacyScreen() {
  const { t } = useLanguage();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft
            size={22}
            color={Colors.neutral[900]}
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {t('privacy.title')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>
          {PRIVACY_TITLE}
        </Text>

        <Text style={styles.meta}>
          {t('privacy.meta', { version: PRIVACY_VERSION, date: PRIVACY_LAST_UPDATED })}
        </Text>

        {PRIVACY_SECTIONS.map((section) => (
          <View
            key={section.title}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>
              {section.title}
            </Text>

            {section.paragraphs.map(
              (paragraph, index) => (
                <Text
                  key={index}
                  style={styles.paragraph}
                >
                  {paragraph}
                </Text>
              )
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[0],
  },

  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },

  backButton: {
    marginRight: 14,
    padding: 4,
  },

  headerTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 18,
    color: Colors.neutral[900],
  },

  content: {
    padding: 24,
    paddingBottom: 60,
    maxWidth: 800,
    width: "100%",
    alignSelf: "center",
  },

  title: {
    fontFamily: FontFamily.display,
    fontSize: 30,
    color: Colors.neutral[900],
    marginBottom: 8,
  },

  meta: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.neutral[500],
    marginBottom: 30,
  },

  section: {
    marginBottom: 24,
  },

  sectionTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 18,
    color: Colors.neutral[900],
    marginBottom: 10,
  },

  paragraph: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 24,
    color: Colors.neutral[700],
    marginBottom: 10,
  },
});