import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Printer, QrCode, Gift, Percent, Sparkles } from "lucide-react-native";
import QRCode from "qrcode";
import { BorderRadius, Colors, FontFamily, Shadows } from "@/constants/theme";

const PROMO_URL = "https://m13club.netlify.app/";
const HERO_IMAGE =
  "https://images.pexels.com/photos/32336392/pexels-photo-32336392.jpeg?auto=compress&cs=tinysrgb&h=650&w=940";

export default function PromoFlyerScreen() {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    if (Platform.OS !== "web") return;

    QRCode.toDataURL(PROMO_URL, {
      width: 700,
      margin: 1,
      color: { dark: Colors.neutral[950], light: "#FFFFFF" },
      errorCorrectionLevel: "H",
    })
      .then(setQrDataUrl)
      .catch((error: unknown) => console.error("QR generation error:", error));
  }, []);

  const handlePrint = useCallback(() => {
    if (Platform.OS === "web") window.print();
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.toolbar} {...({ "data-print": "hide" } as Record<string, string>)}>
        <View style={styles.toolbarInfo}>
          <QrCode size={22} color={Colors.neutral[0]} strokeWidth={2} />
          <Text style={styles.toolbarTitle}>M13 Club Promotional Flyer</Text>
        </View>
        <TouchableOpacity style={styles.printButton} onPress={handlePrint} activeOpacity={0.8}>
          <Printer size={19} color={Colors.primary[950]} strokeWidth={2} />
          <Text style={styles.printButtonText}>Print / Save PDF</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.flyerOuter} {...({ "data-print": "flyer-wrap" } as Record<string, string>)}>
        <View style={styles.flyer} {...({ "data-print": "flyer" } as Record<string, string>)}>
          <Image source={{ uri: HERO_IMAGE }} style={styles.heroImage} resizeMode="cover" />
          <LinearGradient
            colors={["rgba(8, 23, 15, 0.94)", "rgba(8, 23, 15, 0.56)", "rgba(8, 23, 15, 0.08)"]}
            locations={[0, 0.48, 1]}
            start={{ x: 0, y: 0.45 }}
            end={{ x: 1, y: 0.45 }}
            style={styles.leftOverlay}
          />
          <LinearGradient
            colors={["transparent", "rgba(8, 23, 15, 0.82)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.bottomOverlay}
          />

          <View style={styles.flyerContent}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>M13</Text>
              </View>
              <View>
                <Text style={styles.brandName}>M13 CLUB</Text>
                <Text style={styles.brandCaption}>MEMBERSHIP REWARDS</Text>
              </View>
            </View>

            <View style={styles.messageBlock}>
              <Text style={styles.eyebrow}>KHUSUS UNTUK TAMU HOTEL</Text>
              <Text style={styles.headline}>JADIKAN{`\n`}MENGINAP ANDA{`\n`}LEBIH BERHARGA!</Text>
              <Text style={styles.description}>
                Bergabung dengan M13 Club dan nikmati keuntungan eksklusif selama menginap — dan seterusnya.
              </Text>
            </View>

            <View style={styles.qrBlock}>
              <View style={styles.qrFrame}>
                {qrDataUrl ? (
                  <Image source={{ uri: qrDataUrl }} style={styles.qrImage} resizeMode="contain" />
                ) : (
                  <QrCode size={126} color={Colors.neutral[900]} strokeWidth={1.5} />
                )}
              </View>
              <Text style={styles.qrHeading}>SCAN QR CODE</Text>
              <Text style={styles.qrSubheading}>UNTUK MENDAFTAR</Text>
            </View>

            <View style={styles.bottomRow}>
              <Text style={styles.bottomIntro}>
                Tunjukkan nomor keanggotaan Anda di Front Office dan dapatkan M13 Rewards Points di setiap kunjungan.
              </Text>
              <View style={styles.benefitsRow}>
                <Benefit icon={<Sparkles size={25} color={Colors.neutral[0]} strokeWidth={1.7} />} title="Dapatkan" subtitle="Rewards" />
                <Benefit icon={<Gift size={25} color={Colors.neutral[0]} strokeWidth={1.7} />} title="Harga" subtitle="Khusus Member" />
                <Benefit icon={<Percent size={25} color={Colors.neutral[0]} strokeWidth={1.7} />} title="Keuntungan" subtitle="Bertingkat" />
              </View>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerUrl}>{PROMO_URL}</Text>
              <Text style={styles.footerNote}>GRATIS · CEPAT · MUDAH</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.instructions} {...({ "data-print": "hide" } as Record<string, string>)}>
        <Text style={styles.instructionsTitle}>Cara Mencetak</Text>
        <Text style={styles.instructionsText}>
          Pilih Print / Save PDF, gunakan ukuran A4 Portrait, lalu aktifkan opsi mencetak background agar foto dan warna flyer ikut tercetak.
        </Text>
      </View>
    </ScrollView>
  );
}

function Benefit({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <View style={styles.benefit}>
      <View style={styles.benefitIcon}>{icon}</View>
      <Text style={styles.benefitTitle}>{title}</Text>
      <Text style={styles.benefitSubtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Colors.neutral[100], minHeight: "100%" },
  screenContent: { alignItems: "center", padding: 24, paddingBottom: 48 },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    maxWidth: 800,
    backgroundColor: Colors.primary[950],
    borderRadius: BorderRadius.lg,
    padding: 16,
    marginBottom: 24,
    ...Shadows.md,
  },
  toolbarInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  toolbarTitle: { fontFamily: FontFamily.semibold, fontSize: 16, color: Colors.neutral[0] },
  printButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.neutral[0],
    borderRadius: BorderRadius.md,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  printButtonText: { fontFamily: FontFamily.semibold, fontSize: 15, color: Colors.primary[950] },
  flyerOuter: { width: "100%", maxWidth: 800, borderRadius: BorderRadius.xl, overflow: "hidden", ...Shadows.lg },
  flyer: { minHeight: 1120, position: "relative", overflow: "hidden", backgroundColor: Colors.primary[950] },
  heroImage: { position: "absolute", width: "100%", height: "100%", top: 0, left: 0 },
  leftOverlay: { position: "absolute", top: 0, bottom: 0, left: 0, width: "80%" },
  bottomOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, height: "48%" },
  flyerContent: { flex: 1, minHeight: 1120, padding: 46, position: "relative", justifyContent: "space-between" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 14, alignSelf: "flex-start" },
  brandMark: { width: 58, height: 58, borderRadius: BorderRadius.full, borderWidth: 1.5, borderColor: Colors.neutral[0], alignItems: "center", justifyContent: "center" },
  brandMarkText: { fontFamily: FontFamily.display, fontSize: 22, color: Colors.neutral[0] },
  brandName: { fontFamily: FontFamily.display, fontSize: 25, letterSpacing: 1.5, color: Colors.neutral[0] },
  brandCaption: { fontFamily: FontFamily.medium, fontSize: 10, letterSpacing: 2.1, color: Colors.neutral[200], marginTop: 2 },
  messageBlock: { width: "61%", marginTop: 38 },
  eyebrow: { fontFamily: FontFamily.bold, fontSize: 11, letterSpacing: 1.6, color: Colors.accent[300], marginBottom: 15 },
  headline: { fontFamily: FontFamily.bold, fontSize: 35, lineHeight: 39, letterSpacing: 0.6, color: Colors.neutral[0], marginBottom: 18 },
  description: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 23, color: Colors.neutral[100], maxWidth: 370 },
  qrBlock: { alignItems: "center", alignSelf: "flex-start", marginTop: 18, marginLeft: 16 },
  qrFrame: { width: 170, height: 170, backgroundColor: Colors.neutral[0], borderWidth: 7, borderColor: Colors.accent[300], alignItems: "center", justifyContent: "center", ...Shadows.md },
  qrImage: { width: 156, height: 156 },
  qrHeading: { fontFamily: FontFamily.bold, fontSize: 14, letterSpacing: 1.8, color: Colors.neutral[0], marginTop: 12 },
  qrSubheading: { fontFamily: FontFamily.bold, fontSize: 14, letterSpacing: 1.8, color: Colors.neutral[0], marginTop: 2 },
  bottomRow: { flexDirection: "row", alignItems: "flex-end", gap: 20, marginTop: 25 },
  bottomIntro: { flex: 1, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 19, color: Colors.neutral[100], maxWidth: 220 },
  benefitsRow: { flex: 1.6, flexDirection: "row", justifyContent: "space-between", borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.35)", paddingLeft: 18 },
  benefit: { flex: 1, alignItems: "center", borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.22)", paddingHorizontal: 8 },
  benefitIcon: { height: 30, marginBottom: 7 },
  benefitTitle: { fontFamily: FontFamily.semibold, fontSize: 12, color: Colors.neutral[0], textAlign: "center" },
  benefitSubtitle: { fontFamily: FontFamily.regular, fontSize: 11, lineHeight: 15, color: Colors.neutral[200], textAlign: "center" },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.28)", paddingTop: 16, marginTop: 26 },
  footerUrl: { fontFamily: FontFamily.semibold, fontSize: 12, color: Colors.neutral[0] },
  footerNote: { fontFamily: FontFamily.bold, fontSize: 10, letterSpacing: 1.2, color: Colors.accent[300] },
  instructions: { width: "100%", maxWidth: 800, marginTop: 24, backgroundColor: Colors.neutral[0], borderRadius: BorderRadius.lg, padding: 24, ...Shadows.sm },
  instructionsTitle: { fontFamily: FontFamily.semibold, fontSize: 16, color: Colors.neutral[900], marginBottom: 10 },
  instructionsText: { fontFamily: FontFamily.regular, fontSize: 14, color: Colors.neutral[600], lineHeight: 24 },
});
