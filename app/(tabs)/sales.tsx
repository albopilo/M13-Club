import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function SalesScreen() {
  const { member } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vouchers, setVouchers] = useState<any[]>([]);

  const loadVouchers = async () => {
    setLoading(true);

const { data, error } = await supabase
  .from("vouchers")
  .select("*")
  .eq("status", "available")
  .eq("is_active", true)
  .order("created_at", { ascending: true });

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

const confirmSell = (voucher: any) => {

Alert.alert(
  "Sell Voucher",
  `Voucher: ${voucher.description}

Value: MC ${Number(voucher.value)}

After revealing the voucher code:
• This voucher will be marked as SOLD.
• This action will be permanently recorded.
• The voucher code cannot be hidden again.

Do you want to continue?`,
  [
    {
      text: "Cancel",
      style: "cancel",
    },
    {
      text: "Sell & Reveal Code",
      onPress: () => revealVoucher(voucher),
    },
  ]
);
};

const revealVoucher = async (voucher:any)=>{

  const { error } = await supabase
  .from("vouchers")
  .update({
    status: "sold",
    sold_by: member?.id,
    sold_at: new Date().toISOString(),
    revealed_at: new Date().toISOString(),
  })
  .eq("id", voucher.id)
  .eq("status", "available");

if (error) {
  Alert.alert("Error", error.message);
  return;
}

Alert.alert(
  "Voucher Sold Successfully",
  `Voucher

${voucher.description}

Value
MC ${Number(voucher.value)}

Voucher Code

${voucher.code}

Please provide this code to the customer.

This sale has been recorded in the system.`,
  [
    {
      text: "OK",
      onPress: () => loadVouchers(),
    },
  ]
);

};

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={vouchers}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingVertical: 10 }}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.title}>
            {item.description}
          </Text>

          <Text style={styles.value}>
            MC {Number(item.value)}
          </Text>

          <Text style={styles.status}>
            Available
          </Text>

          <TouchableOpacity
    style={styles.sellButton}
    onPress={() => confirmSell(item)}
>
            <Text style={styles.sellText}>
              Sell Voucher
            </Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  card: {
    backgroundColor: "white",
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },

  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
  },

  value: {
    fontSize: 16,
    marginBottom: 4,
  },

  status: {
    color: "green",
    marginBottom: 12,
  },

  sellButton: {
    backgroundColor: "#0A6EFF",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },

  sellText: {
    color: "white",
    fontWeight: "600",
  },
});