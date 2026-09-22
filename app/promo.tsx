import { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, Gift, Wallet, QrCode, Printer, Star, Sparkles } from "lucide-react-native";
import QRCode from "qrcode";
import { Colors, FontFamily, BorderRadius, Shadows } from "@/constants/theme";

const PROMO_URL = "https://m13club.netlify.app/";

export default function PromoFlyerScreen() {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    if (Platform.OS === "web") {
      QRCode.toDataURL(PROMO_URL, {
        width: 600,
        margin: 1,
        color: {
          dark: Colors.primary[950],
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "H",
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("QR generation error:", err));
    }
  }, []);

  const handlePrint = useCallback(() => {
    if (Platform.OS === "web") {
      window.print();
    }
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      {/* On-screen toolbar - hidden in print */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarInfo}>
          <QrCode size={22} color={Colors.neutral[0]} strokeWidth={2} />
          <Text style={styles.toolbarTitle}>Promotional Flyer Generator</Text>
        </View>
        <TouchableOpacity
          style={styles.printButton}
          onPress={handlePrint}
          activeOpacity={0.8}
        >
          <Printer size={20} color={Colors.primary[950]} strokeWidth={2} />
          <Text style={styles.printButtonText}>Print / Save PDF</Text>
        </TouchableOpacity>
      </View>

      {/* Printable flyer */}
      <View style={styles.flyerOuter} {...({ "data-print": "flyer-wrap" } as Record<string, string>)}>
        <LinearGradient
          colors={[Colors.primary[950], Colors.primary[800], Colors.primary[900]]}
          style={styles.flyer}
          {...({ "data-print": "flyer" } as Record<string, string>)}
        >
          {/* Decorative top accent bar */}
          <View style={styles.accentBar} />

          {/* Logo / Brand */}
          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>M13</Text>
            </View>
            <View style={styles.brandTextCol}>
              <Text style={styles.brandName}>M13 CLUB</Text>
              <Text style={styles.brandTagline}>Membership Rewards</Text>
            </View>
          </View>

          {/* Headline */}
          <Text style={styles.headline}>Daftar Sekarang,</Text>
          <Text style={styles.headlineAccent}>Rasakan Kemewahan!</Text>

          {/* Subheadline */}
          <Text style={styles.subheadline}>
            Khusus untuk tamu hotel — bergabunglah dengan M13 Club dan nikmati
            eksklusifitas, hadiah, dan keuntungan luar biasa setiap kali Anda menginap.
          </Text>

          {/* Benefits grid */}
          <View style={styles.benefitsGrid}>
            <View style={styles.benefitCard}>
              <View style={styles.benefitIconCircle}>
                <Wallet size={26} color={Colors.accent[500]} strokeWidth={2} />
              </View>
              <Text style={styles.benefitTitle}>Dompet Digital</Text>
              <Text style={styles.benefitDesc}>
                Saldo MC untuk pembayaran di semua cabang M13
              </Text>
            </View>

            <View style={styles.benefitCard}>
              <View style={styles.benefitIconCircle}>
                <Gift size={26} color={Colors.accent[500]} strokeWidth={2} />
              </View>
              <Text style={styles.benefitTitle}>Voucher Hadiah</Text>
              <Text style={styles.benefitDesc}>
                Tukar kode voucher dan tambah kredit dompet instan
              </Text>
            </View>

            <View style={styles.benefitCard}>
              <View style={styles.benefitIconCircle}>
                <Star size={26} color={Colors.accent[500]} strokeWidth={2} />
              </View>
              <Text style={styles.benefitTitle}>Harga Spesial</Text>
              <Text style={styles.benefitDesc}>
                Diskon & penawaran eksklusif untuk anggota M13 Club
              </Text>
            </View>
          </View>

          {/* QR Code section */}
          <View style={styles.qrSection}>
            <View style={styles.qrCard}>
              {qrDataUrl ? (
                <img src={qrDataUrl} style={styles.qrImage as unknown as React.CSSProperties} alt="Scan untuk daftar M13 Club" />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <QrCode size={120} color={Colors.primary[300]} strokeWidth={1.5} />
                </View>
              )}
            </View>
            <View style={styles.qrTextCol}>
              <View style={styles.scanBadge}>
                <Sparkles size={16} color={Colors.primary[950]} strokeWidth={2} />
                <Text style={styles.scanBadgeText}>GRATIS · CEPAT · MUDAH</Text>
              </View>
              <Text style={styles.qrTitle}>Scan QR Code</Text>
              <Text style={styles.qrSubtitle}>
                Arahkan kamera ponsel Anda ke kode QR untuk mendaftar
                sebagai anggota M13 Club dalam hitungan detik.
              </Text>
              <View style={styles.urlRow}>
                <Text style={styles.urlLabel}>Atau kunjungi:</Text>
                <Text style={styles.urlText}>{PROMO_URL}</Text>
              </View>
            </View>
          </View>

          {/* CTA bar */}
          <View style={styles.ctaBar}>
            <View style={styles.ctaLeft}>
              <Text style={styles.ctaHeading}>Jadi Anggota Hari Ini</Text>
              <Text style={styles.ctaSubheading}>
                Pendaftaran gratis — hanya butuh 1 menit!
              </Text>
            </View>
            <View style={styles.ctaRight}>
              <Text style={styles.ctaArrow}>
                <ArrowRight size={28} color={Colors.neutral[0]} strokeWidth={2} />
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              M13 Club · Membership Rewards Program
            </Text>
            <Text style={styles.footerSub}>
              Nikmati kemewahan, raih setiap keuntungan
            </Text>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>Cara Mencetak</Text>
        <Text style={styles.instructionsText}>
          1. Klik tombol "Print / Save PDF" di atas.{"\n"}
          2. Pilih printer atau "Save as PDF".{"\n"}
          3. Set ukuran kertas A4, orientasi Portrait.{"\n"}
          4. Cetak dan tempel di area resepsionis hotel atau kamar tamu.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: Colors.neutral[100],
    minHeight: "100%",
  },
  screenContent: {
    alignItems: "center",
    padding: 24,
    paddingBottom: 48,
  },

  // Toolbar (hidden in print)
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    maxWidth: 800,
    backgroundColor: Colors.primary[900],
    borderRadius: BorderRadius.lg,
    padding: 16,
    marginBottom: 24,
    ...Shadows.md,
  },
  toolbarInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  toolbarTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 16,
    color: Colors.neutral[0],
  },
  printButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.neutral[0],
    borderRadius: BorderRadius.md,
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...Shadows.sm,
  },
  printButtonText: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    color: Colors.primary[950],
  },

  // Flyer outer wrapper
  flyerOuter: {
    width: "100%",
    maxWidth: 800,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    ...Shadows.lg,
  },

  // The flyer itself
  flyer: {
    padding: 48,
  paddingBottom: 40,
  minHeight: 1000,
  position: "relative",
  },

  // Decorative accent bar
  accentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: Colors.accent[500],
  },

  // Brand
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 40,
    marginTop: 8,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.neutral[0],
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
  },
  logoText: {
    fontFamily: FontFamily.display,
    fontSize: 24,
    color: Colors.primary[950],
  },
  brandTextCol: {
    flexDirection: "column",
  },
  brandName: {
    fontFamily: FontFamily.display,
    fontSize: 26,
    color: Colors.neutral[0],
    lineHeight: 30,
  },
  brandTagline: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: Colors.primary[200],
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  // Headline
  headline: {
    fontFamily: FontFamily.display,
    fontSize: 42,
    color: Colors.neutral[0],
    lineHeight: 50,
  },
  headlineAccent: {
    fontFamily: FontFamily.display,
    fontSize: 42,
    color: Colors.accent[400],
    lineHeight: 50,
    marginBottom: 20,
  },
  subheadline: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    color: Colors.primary[100],
    lineHeight: 26,
    marginBottom: 36,
    maxWidth: 620,
  },

  // Benefits
  benefitsGrid: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 40,
  },
  benefitCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: BorderRadius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  benefitIconCircle: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255,122,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  benefitTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 16,
    color: Colors.neutral[0],
    marginBottom: 6,
  },
  benefitDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.primary[200],
    lineHeight: 20,
  },

  // QR section
  qrSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 32,
    backgroundColor: Colors.neutral[0],
    borderRadius: BorderRadius.xl,
    padding: 32,
    marginBottom: 32,
    ...Shadows.lg,
  },
  qrCard: {
    width: 200,
    height: 200,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    backgroundColor: Colors.neutral[0],
    alignItems: "center",
    justifyContent: "center",
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  qrTextCol: {
    flex: 1,
    flexDirection: "column",
  },
  scanBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accent[100],
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  scanBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.primary[950],
    letterSpacing: 1.5,
  },
  qrTitle: {
    fontFamily: FontFamily.display,
    fontSize: 28,
    color: Colors.primary[950],
    marginBottom: 10,
  },
  qrSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: Colors.neutral[600],
    lineHeight: 24,
    marginBottom: 18,
  },
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  urlLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.neutral[500],
  },
  urlText: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    color: Colors.primary[700],
  },

  // CTA bar
  ctaBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.accent[500],
    borderRadius: BorderRadius.lg,
    padding: 24,
    marginBottom: 32,
  },
  ctaLeft: {
    flex: 1,
  },
  ctaHeading: {
    fontFamily: FontFamily.display,
    fontSize: 24,
    color: Colors.primary[950],
    marginBottom: 4,
  },
  ctaSubheading: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: Colors.primary[900],
  },
  ctaRight: {
    alignItems: "center",
    justifyContent: "center",
  },
  ctaArrow: {
    alignItems: "center",
    justifyContent: "center",
  },

  // Footer
  footer: {
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
    paddingTop: 24,
  },
  footerText: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    color: Colors.neutral[300],
    marginBottom: 4,
  },
  footerSub: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.primary[300],
  },

  // Instructions (hidden in print)
  instructions: {
    width: "100%",
    maxWidth: 800,
    marginTop: 24,
    backgroundColor: Colors.neutral[0],
    borderRadius: BorderRadius.lg,
    padding: 24,
    ...Shadows.sm,
  },
  instructionsTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 16,
    color: Colors.neutral[900],
    marginBottom: 10,
  },
  instructionsText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: Colors.neutral[600],
    lineHeight: 24,
  },
});
