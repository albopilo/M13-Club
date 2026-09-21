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
import { useLanguage } from "@/context/LanguageContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface VoucherCategory {
  value: number;
  available_count: number;
}

export default function SalesScreen() {
  const { member } = useAuth();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<VoucherCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<VoucherCategory | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selling, setSelling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [soldVoucher, setSoldVoucher] = useState<{ code: string; description: string; value: number } | null>(null);

  const loadCategories = async () => {
    setLoading(true);

    const { data, error } = await supabase.rpc("get_voucher_categories");

    if (error) {
      console.log(error);
    } else {
      const parsed = data as VoucherCategory[] | { success: boolean; error?: string };
      if (Array.isArray(parsed)) {
        setCategories(parsed);
        if (selectedCategory) {
          const updated = parsed.find((c) => c.value === selectedCategory.value);
          if (!updated) {
            setSelectedCategory(null);
          } else {
            setSelectedCategory(updated);
          }
        }
      } else {
        setCategories([]);
        setSelectedCategory(null);
      }
    }

    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [])
  );

  const confirmSell = () => {
    if (!selectedCategory) {
      Alert.alert(t("sales.noCategorySelected"));
      return;
    }
    setCopied(false);
    setShowConfirmModal(true);
  };

  const revealVoucher = async () => {
    if (selling || !selectedCategory) {
      return;
    }

    setSelling(true);

    const { data, error } = await supabase.rpc("sell_voucher_by_category", {
      p_value: selectedCategory.value,
    });

    setSelling(false);

    if (error) {
      setShowConfirmModal(false);
      Alert.alert(t("sales.unableSell"), error.message);
      return;
    }

    const r = data as { success: boolean; error?: string; code?: string; description?: string; value?: number };

    if (!r.success) {
      setShowConfirmModal(false);
      Alert.alert(t("sales.unableSell"), r.error || "Failed");
      return;
    }

    setSoldVoucher({
      code: r.code!,
      description: r.description!,
      value: r.value!,
    });

    setShowConfirmModal(false);
    setCopied(false);
    setShowSuccessModal(true);
  };

  const copyVoucherCode = async () => {
    if (!soldVoucher?.code) {
      return;
    }

    await Clipboard.setStringAsync(String(soldVoucher.code));

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const finishSale = () => {
    setShowSuccessModal(false);
    setSoldVoucher(null);
    setCopied(false);
    loadCategories();
  };

  const formatValue = (v: number) => {
    return Number(v) % 1 === 0 ? Number(v).toString() : Number(v).toFixed(2);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0A6EFF" />
        <Text style={styles.loadingText}>{t("sales.loading")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("sales.title")}</Text>
        <Text style={styles.headerSubtitle}>{t("sales.subtitle")}</Text>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.value.toString()}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.section}>
            {/* Category Picker */}
            <Text style={styles.sectionLabel}>{t("sales.selectCategory")}</Text>

            <TouchableOpacity
              style={styles.pickerButton}
              activeOpacity={0.8}
              onPress={() => setShowCategoryPicker(true)}
            >
              <View style={styles.pickerContent}>
                {selectedCategory ? (
                  <>
                    <Text style={styles.pickerValueText}>
                      {t("sales.categoryValue", { value: formatValue(selectedCategory.value) })}
                    </Text>
                    <View style={styles.pickerBadge}>
                      <Text style={styles.pickerBadgeText}>
                        {t("sales.availableCodes", { count: selectedCategory.available_count })}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.pickerPlaceholder}>
                    {t("sales.selectCategoryPlaceholder")}
                  </Text>
                )}
              </View>

              <Text style={styles.pickerChevron}>▾</Text>
            </TouchableOpacity>

            {/* Sell button */}
            <TouchableOpacity
              style={[styles.sellButton, !selectedCategory && styles.sellButtonDisabled]}
              activeOpacity={0.8}
              disabled={!selectedCategory}
              onPress={confirmSell}
            >
              <Text style={styles.sellText}>{t("sales.sellVoucher")}</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.categoryCard,
              selectedCategory?.value === item.value && styles.categoryCardSelected,
            ]}
            activeOpacity={0.8}
            onPress={() => {
              setSelectedCategory(item);
            }}
          >
            <View style={styles.categoryCardLeft}>
              <Text style={styles.categoryCardValue}>
                MC {formatValue(item.value)}
              </Text>
              <Text style={styles.categoryCardLabel}>
                {t("sales.voucherValue")}
              </Text>
            </View>

            <View style={styles.categoryCardRight}>
              <View style={styles.availableBadge}>
                <View style={styles.availableDot} />
                <Text style={styles.availableText}>
                  {t("sales.availableCodes", { count: item.available_count })}
                </Text>
              </View>

              {selectedCategory?.value === item.value && (
                <View style={styles.selectedCheck}>
                  <Text style={styles.selectedCheckText}>✓</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>✓</Text>
            </View>
            <Text style={styles.emptyTitle}>{t("sales.noVouchers")}</Text>
            <Text style={styles.emptyText}>{t("sales.noVouchersDesc")}</Text>
          </View>
        }
      />

      {/* ===================================================== */}
      {/* CATEGORY PICKER MODAL */}
      {/* ===================================================== */}
      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCategoryPicker(false)}>
          <Pressable style={styles.pickerModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>{t("sales.selectCategory")}</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Text style={styles.pickerModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={categories}
              keyExtractor={(item) => item.value.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    selectedCategory?.value === item.value && styles.pickerItemSelected,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedCategory(item);
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={styles.pickerItemValue}>
                    MC {formatValue(item.value)}
                  </Text>
                  <View style={styles.pickerItemBadge}>
                    <Text style={styles.pickerItemBadgeText}>
                      {t("sales.availableCodes", { count: item.available_count })}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 400 }}
            />
          </Pressable>
        </Pressable>
      </Modal>

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
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            {!selling ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalIcon}>
                    <Text style={styles.modalIconText}>$</Text>
                  </View>
                  <Text style={styles.modalTitle}>{t("sales.sellVoucherModal")}</Text>
                  <Text style={styles.modalSubtitle}>{t("sales.reviewBefore")}</Text>
                </View>

                <View style={styles.voucherSummary}>
                  <Text style={styles.summaryLabel}>{t("sales.voucherValue")}</Text>
                  <Text style={styles.summaryValue}>
                    MC {selectedCategory ? formatValue(selectedCategory.value) : "0"}
                  </Text>
                  <Text style={styles.summaryAvailable}>
                    {selectedCategory
                      ? t("sales.availableCodes", { count: selectedCategory.available_count })
                      : ""}
                  </Text>
                </View>

                <View style={styles.warningBox}>
                  <View style={styles.warningIcon}>
                    <Text style={styles.warningIconText}>!</Text>
                  </View>
                  <View style={styles.warningContent}>
                    <Text style={styles.warningTitle}>{t("sales.cannotUndo")}</Text>
                    <Text style={styles.warningText}>{t("sales.cannotUndoDesc")}</Text>
                  </View>
                </View>

                <View style={styles.infoSection}>
                  <Text style={styles.infoSectionTitle}>{t("sales.afterConfirm")}</Text>

                  <View style={styles.infoRow}>
                    <View style={styles.checkCircle}>
                      <Text style={styles.checkText}>✓</Text>
                    </View>
                    <Text style={styles.infoText}>{t("sales.voucherSold")}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <View style={styles.checkCircle}>
                      <Text style={styles.checkText}>✓</Text>
                    </View>
                    <Text style={styles.infoText}>{t("sales.saleRecorded")}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <View style={styles.checkCircle}>
                      <Text style={styles.checkText}>✓</Text>
                    </View>
                    <Text style={styles.infoText}>{t("sales.codeRevealed")}</Text>
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  <Pressable
                    style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]}
                    onPress={() => setShowConfirmModal(false)}
                  >
                    <Text style={styles.cancelText}>{t("sales.cancel")}</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.confirmButton, pressed && styles.buttonPressed]}
                    onPress={revealVoucher}
                  >
                    <Text style={styles.confirmText}>{t("sales.sellReveal")}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.processingContainer}>
                <View style={styles.processingIcon}>
                  <ActivityIndicator size="large" color="#0A6EFF" />
                </View>
                <Text style={styles.processingTitle}>{t("sales.selling")}</Text>
                <Text style={styles.processingText}>{t("sales.sellingDesc")}</Text>
                <Text style={styles.processingVoucher}>
                  MC {selectedCategory ? formatValue(selectedCategory.value) : ""}
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
            <View style={styles.successHeader}>
              <View style={styles.successIcon}>
                <Text style={styles.successIconText}>✓</Text>
              </View>
              <Text style={styles.successTitle}>{t("sales.voucherSoldTitle")}</Text>
              <Text style={styles.successSubtitle}>{t("sales.saleSuccess")}</Text>
            </View>

            <View style={styles.successVoucherInfo}>
              <Text style={styles.successDescription} numberOfLines={2}>
                {soldVoucher?.description}
              </Text>
              <Text style={styles.successValue}>
                MC {soldVoucher ? formatValue(soldVoucher.value) : "0"}
              </Text>
            </View>

            <View style={styles.codeSection}>
              <Text style={styles.codeLabel}>{t("sales.voucherCode")}</Text>
              <View style={styles.codeContainer}>
                <Text style={styles.codeText} selectable numberOfLines={2}>
                  {soldVoucher?.code}
                </Text>
                <TouchableOpacity
                  style={[styles.copyButton, copied && styles.copyButtonCopied]}
                  activeOpacity={0.8}
                  onPress={copyVoucherCode}
                >
                  <Text style={[styles.copyText, copied && styles.copyTextCopied]}>
                    {copied ? t("sales.copied") : t("sales.copy")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.instructionBox}>
              <View style={styles.instructionIcon}>
                <Text style={styles.instructionIconText}>i</Text>
              </View>
              <Text style={styles.instructionText}>{t("sales.provideCode")}</Text>
            </View>

            <View style={styles.recordedRow}>
              <View style={styles.recordedCheck}>
                <Text style={styles.recordedCheckText}>✓</Text>
              </View>
              <Text style={styles.recordedText}>{t("sales.saleRecordedSuccess")}</Text>
            </View>

            <TouchableOpacity style={styles.doneButton} activeOpacity={0.8} onPress={finishSale}>
              <Text style={styles.doneText}>{t("sales.done")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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

  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#101828",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#667085",
    marginTop: 4,
  },

  listContent: {
    paddingTop: 6,
  },

  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#344054",
    marginBottom: 8,
    letterSpacing: 0.3,
  },

  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 14,
  },
  pickerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  pickerValueText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#101828",
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: "#98A2B3",
  },
  pickerBadge: {
    backgroundColor: "#ECFDF3",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pickerBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#027A48",
  },
  pickerChevron: {
    fontSize: 18,
    color: "#98A2B3",
  },

  sellButton: {
    backgroundColor: "#0A6EFF",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sellButtonDisabled: {
    backgroundColor: "#D0D5DD",
  },
  sellText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryCardSelected: {
    borderColor: "#0A6EFF",
    backgroundColor: "#F0F6FF",
  },
  categoryCardLeft: {
    flex: 1,
  },
  categoryCardValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#101828",
  },
  categoryCardLabel: {
    fontSize: 12,
    color: "#667085",
    marginTop: 2,
  },
  categoryCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  availableBadge: {
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
    letterSpacing: 0.3,
  },
  selectedCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#0A6EFF",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedCheckText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingVertical: 60,
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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(16, 24, 40, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },

  pickerModal: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
  },
  pickerModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  pickerModalTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#101828",
  },
  pickerModalClose: {
    fontSize: 20,
    color: "#98A2B3",
    fontWeight: "600",
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: "#EAECF0",
  },
  pickerItemSelected: {
    borderColor: "#0A6EFF",
    backgroundColor: "#F0F6FF",
  },
  pickerItemValue: {
    fontSize: 17,
    fontWeight: "700",
    color: "#101828",
  },
  pickerItemBadge: {
    backgroundColor: "#ECFDF3",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pickerItemBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#027A48",
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
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#667085",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#101828",
  },
  summaryAvailable: {
    fontSize: 13,
    color: "#027A48",
    fontWeight: "600",
    marginTop: 6,
  },

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
