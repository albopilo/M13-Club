import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { supabase } from "@/lib/supabase";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SalesScreen() {
  const { member } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [vouchers, setVouchers] = useState<any[]>([]);

  // UI state
  const [selectedVoucher, setSelectedVoucher] = useState<any | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selling, setSelling] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadVouchers = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("vouchers")
      .select("*")
      .eq("status", "available")
      .eq("is_active", true)
      // Always sort vouchers by MC value, lowest to highest.
      .order("value", { ascending: true })
      // Stable secondary ordering when two vouchers have the same value.
      .order("id", { ascending: true });

    if (error) {
      console.log(error);
    } else {
      setVouchers(data || []);
    }

    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadVouchers();
    }, [])
  );

  /*
   * Open the confirmation modal.
   */
  const confirmSell = (voucher: any) => {
    setSelectedVoucher(voucher);
    setCopied(false);
    setShowConfirmModal(true);
  };

  /*
   * Sell the voucher and reveal its code.
   *
   * Database functionality remains the same as before.
   */
  const revealVoucher = async (voucher: any) => {
    if (selling) {
      return;
    }

    setSelling(true);

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("vouchers")
      .update({
        status: "sold",
        sold_by: member?.id,
        sold_at: now,
        revealed_at: now,
      })
      .eq("id", voucher.id)
      .eq("status", "available");

    setSelling(false);

    if (error) {
      setShowConfirmModal(false);
      Alert.alert("Unable to Sell Voucher", error.message);
      return;
    }

    /*
     * Close confirmation modal and open
     * the dedicated success modal.
     */
    setShowConfirmModal(false);
    setSelectedVoucher(voucher);
    setCopied(false);
    setShowSuccessModal(true);
  };

  /*
   * Copy voucher code to clipboard.
   */
  const copyVoucherCode = async () => {
    if (!selectedVoucher?.code) {
      return;
    }

    await Clipboard.setStringAsync(String(selectedVoucher.code));

    setCopied(true);

    /*
     * Reset the "Copied" state after a short delay.
     */
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  /*
   * Close the success modal and refresh
   * the available voucher list.
   */
  const finishSale = () => {
    setShowSuccessModal(false);
    setSelectedVoucher(null);
    setCopied(false);
    loadVouchers();
  };

  /*
   * Loading screen.
   */
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0A6EFF" />

        <Text style={styles.loadingText}>
          Loading vouchers...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={vouchers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          vouchers.length === 0
            ? [
                styles.emptyList,
                {
                  paddingBottom: insets.bottom + 24,
                },
              ]
            : [
                styles.listContent,
                {
                  paddingBottom: insets.bottom + 90,
                },
              ]
        }
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {/* Voucher information */}
            <View style={styles.cardTop}>
              <View style={styles.titleContainer}>
                <Text style={styles.title} numberOfLines={2}>
                  {item.description}
                </Text>

                <View style={styles.availableBadge}>
                  <View style={styles.availableDot} />

                  <Text style={styles.availableText}>
                    AVAILABLE
                  </Text>
                </View>
              </View>
            </View>

            {/* Voucher value */}
            <View style={styles.valueContainer}>
              <Text style={styles.valueLabel}>
                Voucher Value
              </Text>

              <Text style={styles.value}>
                MC {Number(item.value)}
              </Text>
            </View>

            {/* Sell button */}
            <TouchableOpacity
              style={styles.sellButton}
              activeOpacity={0.8}
              onPress={() => confirmSell(item)}
            >
              <Text style={styles.sellText}>
                Sell Voucher
              </Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>
                ✓
              </Text>
            </View>

            <Text style={styles.emptyTitle}>
              No Vouchers Available
            </Text>

            <Text style={styles.emptyText}>
              There are currently no active vouchers
              available for sale.
            </Text>
          </View>
        }
      />

      {/* ===================================================== */}
      {/* CONFIRMATION MODAL */}
      {/* ===================================================== */}

      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!selling) {
            setShowConfirmModal(false);
            setSelectedVoucher(null);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            {!selling ? (
              <>
                {/* Modal header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalIcon}>
                    <Text style={styles.modalIconText}>
                      $
                    </Text>
                  </View>

                  <Text style={styles.modalTitle}>
                    Sell Voucher
                  </Text>

                  <Text style={styles.modalSubtitle}>
                    Review this voucher before completing
                    the sale.
                  </Text>
                </View>

                {/* Voucher summary */}
                <View style={styles.voucherSummary}>
                  <Text
                    style={styles.summaryDescription}
                    numberOfLines={2}
                  >
                    {selectedVoucher?.description}
                  </Text>

                  <Text style={styles.summaryValue}>
                    MC{" "}
                    {Number(selectedVoucher?.value || 0)}
                  </Text>
                </View>

                {/* Warning */}
                <View style={styles.warningBox}>
                  <View style={styles.warningIcon}>
                    <Text style={styles.warningIconText}>
                      !
                    </Text>
                  </View>

                  <View style={styles.warningContent}>
                    <Text style={styles.warningTitle}>
                      This action cannot be undone
                    </Text>

                    <Text style={styles.warningText}>
                      After confirmation, this voucher will
                      be marked as SOLD and its code will be
                      revealed.
                    </Text>
                  </View>
                </View>

                {/* What happens */}
                <View style={styles.infoSection}>
                  <Text style={styles.infoSectionTitle}>
                    After confirmation
                  </Text>

                  <View style={styles.infoRow}>
                    <View style={styles.checkCircle}>
                      <Text style={styles.checkText}>
                        ✓
                      </Text>
                    </View>

                    <Text style={styles.infoText}>
                      Voucher becomes SOLD
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <View style={styles.checkCircle}>
                      <Text style={styles.checkText}>
                        ✓
                      </Text>
                    </View>

                    <Text style={styles.infoText}>
                      Sale is recorded
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <View style={styles.checkCircle}>
                      <Text style={styles.checkText}>
                        ✓
                      </Text>
                    </View>

                    <Text style={styles.infoText}>
                      Voucher code is revealed
                    </Text>
                  </View>
                </View>

                {/* Buttons */}
                <View style={styles.modalButtons}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.cancelButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => {
                      setShowConfirmModal(false);
                      setSelectedVoucher(null);
                    }}
                  >
                    <Text style={styles.cancelText}>
                      Cancel
                    </Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.confirmButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => {
                      if (selectedVoucher) {
                        revealVoucher(selectedVoucher);
                      }
                    }}
                  >
                    <Text style={styles.confirmText}>
                      Sell & Reveal
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              /* ================================================= */
              /* PROCESSING STATE */
              /* ================================================= */
              <View style={styles.processingContainer}>
                <View style={styles.processingIcon}>
                  <ActivityIndicator
                    size="large"
                    color="#0A6EFF"
                  />
                </View>

                <Text style={styles.processingTitle}>
                  Selling Voucher...
                </Text>

                <Text style={styles.processingText}>
                  Please wait while we record the sale.
                </Text>

                <Text style={styles.processingVoucher}>
                  {selectedVoucher?.description}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ===================================================== */}
      {/* SUCCESS MODAL */}
      {/* ===================================================== */}

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={finishSale}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            {/* Success header */}
            <View style={styles.successHeader}>
              <View style={styles.successIcon}>
                <Text style={styles.successIconText}>
                  ✓
                </Text>
              </View>

              <Text style={styles.successTitle}>
                Voucher Sold
              </Text>

              <Text style={styles.successSubtitle}>
                The sale has been recorded successfully.
              </Text>
            </View>

            {/* Voucher information */}
            <View style={styles.successVoucherInfo}>
              <Text
                style={styles.successDescription}
                numberOfLines={2}
              >
                {selectedVoucher?.description}
              </Text>

              <Text style={styles.successValue}>
                MC{" "}
                {Number(selectedVoucher?.value || 0)}
              </Text>
            </View>

            {/* Voucher code */}
            <View style={styles.codeSection}>
              <Text style={styles.codeLabel}>
                VOUCHER CODE
              </Text>

              <View style={styles.codeContainer}>
                <Text
                  style={styles.codeText}
                  selectable
                  numberOfLines={2}
                >
                  {selectedVoucher?.code}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.copyButton,
                    copied && styles.copyButtonCopied,
                  ]}
                  activeOpacity={0.8}
                  onPress={copyVoucherCode}
                >
                  <Text
                    style={[
                      styles.copyText,
                      copied && styles.copyTextCopied,
                    ]}
                  >
                    {copied ? "Copied" : "Copy"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Instruction */}
            <View style={styles.instructionBox}>
              <View style={styles.instructionIcon}>
                <Text style={styles.instructionIconText}>
                  i
                </Text>
              </View>

              <Text style={styles.instructionText}>
                Please provide this voucher code to the
                customer.
              </Text>
            </View>

            {/* Recorded status */}
            <View style={styles.recordedRow}>
              <View style={styles.recordedCheck}>
                <Text style={styles.recordedCheckText}>
                  ✓
                </Text>
              </View>

              <Text style={styles.recordedText}>
                Sale recorded successfully
              </Text>
            </View>

            {/* Done button */}
            <TouchableOpacity
              style={styles.doneButton}
              activeOpacity={0.8}
              onPress={finishSale}
            >
              <Text style={styles.doneText}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * =========================================================
   * MAIN SCREEN
   * =========================================================
   */
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#667085",
  },

  listContent: {
    paddingTop: 10,

    /*
     * Bottom padding is applied dynamically using
     * the device safe-area inset plus additional space
     * for the bottom tab bar.
     */
    paddingBottom: 90,
  },

  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },

  /*
   * =========================================================
   * VOUCHER CARD
   * =========================================================
   */
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 12,
    marginVertical: 7,
    padding: 16,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  titleContainer: {
    flex: 1,
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#101828",
    marginBottom: 8,
  },

  availableBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF3",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },

  availableDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#12B76A",
    marginRight: 6,
  },

  availableText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#027A48",
    letterSpacing: 0.5,
  },

  valueContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },

  valueLabel: {
    fontSize: 12,
    color: "#667085",
    marginBottom: 3,
  },

  value: {
    fontSize: 20,
    fontWeight: "700",
    color: "#101828",
  },

  sellButton: {
    backgroundColor: "#0A6EFF",
    paddingVertical: 13,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  sellText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  /*
   * =========================================================
   * EMPTY STATE
   * =========================================================
   */
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ECFDF3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  emptyIconText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#12B76A",
  },

  emptyTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#101828",
    marginBottom: 8,
  },

  emptyText: {
    fontSize: 14,
    color: "#667085",
    textAlign: "center",
    lineHeight: 21,
  },

  /*
   * =========================================================
   * MODAL
   * =========================================================
   */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(16, 24, 40, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },

  confirmModal: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
  },

  successModal: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
  },

  /*
   * =========================================================
   * CONFIRMATION MODAL
   * =========================================================
   */
  modalHeader: {
    alignItems: "center",
    marginBottom: 18,
  },

  modalIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  modalIconText: {
    fontSize: 25,
    fontWeight: "800",
    color: "#0A6EFF",
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#101828",
    marginBottom: 5,
  },

  modalSubtitle: {
    fontSize: 13,
    color: "#667085",
    textAlign: "center",
    lineHeight: 19,
  },

  voucherSummary: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },

  summaryDescription: {
    fontSize: 17,
    fontWeight: "700",
    color: "#101828",
    marginBottom: 4,
  },

  summaryValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#475467",
  },

  /*
   * Warning
   */
  warningBox: {
    flexDirection: "row",
    backgroundColor: "#FFFAEB",
    borderWidth: 1,
    borderColor: "#FEDF89",
    borderRadius: 11,
    padding: 12,
    marginBottom: 16,
  },

  warningIcon: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: "#F79009",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  warningIconText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },

  warningContent: {
    flex: 1,
  },

  warningTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#93370D",
    marginBottom: 3,
  },

  warningText: {
    fontSize: 12,
    color: "#B54708",
    lineHeight: 18,
  },

  /*
   * Information list
   */
  infoSection: {
    marginBottom: 20,
  },

  infoSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#344054",
    marginBottom: 9,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ECFDF3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  checkText: {
    color: "#12B76A",
    fontSize: 12,
    fontWeight: "800",
  },

  infoText: {
    fontSize: 13,
    color: "#475467",
  },

  /*
   * Modal buttons
   */
  modalButtons: {
    flexDirection: "row",
    gap: 10,
  },

  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
    paddingVertical: 13,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelText: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "700",
  },

  confirmButton: {
    flex: 1.25,
    backgroundColor: "#0A6EFF",
    paddingVertical: 13,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  confirmText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  buttonPressed: {
    opacity: 0.7,
  },

  /*
   * =========================================================
   * PROCESSING STATE
   * =========================================================
   */
  processingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 35,
  },

  processingIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  processingTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#101828",
    marginBottom: 7,
  },

  processingText: {
    fontSize: 13,
    color: "#667085",
    textAlign: "center",
    marginBottom: 18,
  },

  processingVoucher: {
    fontSize: 14,
    fontWeight: "600",
    color: "#344054",
    textAlign: "center",
  },

  /*
   * =========================================================
   * SUCCESS MODAL
   * =========================================================
   */
  successHeader: {
    alignItems: "center",
    marginBottom: 18,
  },

  successIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#ECFDF3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  successIconText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#12B76A",
  },

  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#101828",
    marginBottom: 5,
  },

  successSubtitle: {
    fontSize: 13,
    color: "#667085",
    textAlign: "center",
  },

  successVoucherInfo: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },

  successDescription: {
    fontSize: 17,
    fontWeight: "700",
    color: "#101828",
    textAlign: "center",
    marginBottom: 4,
  },

  successValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#475467",
  },

  /*
   * Voucher code
   */
  codeSection: {
    marginBottom: 15,
  },

  codeLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#667085",
    letterSpacing: 1,
    marginBottom: 7,
  },

  codeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 11,
    padding: 6,
    paddingLeft: 14,
  },

  codeText: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: "#101828",
    letterSpacing: 1,
  },

  copyButton: {
    backgroundColor: "#0A6EFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
  },

  copyButtonCopied: {
    backgroundColor: "#ECFDF3",
    borderWidth: 1,
    borderColor: "#A6F4C5",
  },

  copyText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  copyTextCopied: {
    color: "#027A48",
  },

  /*
   * Instruction
   */
  instructionBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF8FF",
    borderRadius: 10,
    padding: 11,
    marginBottom: 14,
  },

  instructionIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#0A6EFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  instructionIconText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  instructionText: {
    flex: 1,
    fontSize: 12,
    color: "#175CD3",
    lineHeight: 17,
  },

  /*
   * Recorded status
   */
  recordedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
  },

  recordedCheck: {
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: "#ECFDF3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  recordedCheckText: {
    color: "#12B76A",
    fontSize: 12,
    fontWeight: "800",
  },

  recordedText: {
    fontSize: 13,
    color: "#027A48",
    fontWeight: "600",
  },

  /*
   * Done
   */
  doneButton: {
    backgroundColor: "#0A6EFF",
    paddingVertical: 14,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  doneText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});