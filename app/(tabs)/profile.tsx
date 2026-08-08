import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import {
  User as UserIcon,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Heart,
  LogOut,
  Edit3,
  Check,
  X,
  Shield,
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ROLE_LABELS: Record<string, string> = {
  member: 'Member',
  admin: 'Administrator',
  super_admin: 'Super Administrator',
  staff: 'Staff',
  finance: 'Finance',
  manager: 'Manager',
  support: 'Support',
};

export default function ProfileScreen() {
  const { member, signOut, refreshMember } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({
    full_name: member?.full_name || '',
    phone: member?.phone || '',
    date_of_birth: member?.date_of_birth || '',
    gender: member?.gender || '',
    address: member?.address || '',
    emergency_contact_name: member?.emergency_contact_name || '',
    emergency_contact_phone: member?.emergency_contact_phone || '',
  });

  const insets = useSafeAreaInsets();

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshMember();
    setRefreshing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('members')
      .update({
        full_name: form.full_name,
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        address: form.address || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
      })
      .eq('id', member?.id);
    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      await refreshMember();
      setEditing(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const formatDate = (d: string) => {
    if (!d) return 'Not set';
    return new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
    paddingBottom: 140 + insets.bottom,
}}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[Colors.primary[900], Colors.primary[700]]}
        style={styles.profileHeader}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(member?.full_name || 'M').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.profileName}>{member?.full_name}</Text>
        <View style={styles.roleBadge}>
          <Shield size={12} color={Colors.neutral[0]} strokeWidth={2} />
          <Text style={styles.roleText}>{ROLE_LABELS[member?.role || 'member'] || 'Member'}</Text>
        </View>
        <Text style={styles.memberNumber}>{member?.member_number}</Text>
      </LinearGradient>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          {!editing ? (
            <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
              <Edit3 size={16} color={Colors.primary[700]} strokeWidth={2} />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editActions}>
              <TouchableOpacity onPress={() => setEditing(false)} style={styles.cancelBtn}>
                <X size={18} color={Colors.neutral[500]} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
                {saving ? (
                  <ActivityIndicator size={16} color={Colors.neutral[0]} />
                ) : (
                  <Check size={18} color={Colors.neutral[0]} strokeWidth={2} />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.infoCard}>
          {editing ? (
            <>
              <EditField label="Full Name" icon={UserIcon} value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
              <EditField label="Phone" icon={Phone} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
              <EditField label="Date of Birth (YYYY-MM-DD)" icon={Calendar} value={form.date_of_birth} onChange={(v) => setForm({ ...form, date_of_birth: v })} />
              <EditField label="Gender (male/female/other)" icon={UserIcon} value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} />
              <EditField label="Address" icon={MapPin} value={form.address} onChange={(v) => setForm({ ...form, address: v })} multiline />
              <EditField label="Emergency Contact Name" icon={Heart} value={form.emergency_contact_name} onChange={(v) => setForm({ ...form, emergency_contact_name: v })} />
              <EditField label="Emergency Contact Phone" icon={Phone} value={form.emergency_contact_phone} onChange={(v) => setForm({ ...form, emergency_contact_phone: v })} keyboardType="phone-pad" />
            </>
          ) : (
            <>
              <InfoRow icon={Mail} label="Email" value={member?.email || 'Not set'} />
              <InfoRow icon={Phone} label="Phone" value={member?.phone || 'Not set'} />
              <InfoRow icon={Calendar} label="Date of Birth" value={formatDate(member?.date_of_birth || '')} />
              <InfoRow icon={UserIcon} label="Gender" value={member?.gender ? member.gender.charAt(0).toUpperCase() + member.gender.slice(1) : 'Not set'} />
              <InfoRow icon={MapPin} label="Address" value={member?.address || 'Not set'} />
              <InfoRow icon={Calendar} label="Joined" value={formatDate(member?.joined_at || '')} />
              <InfoRow icon={Heart} label="Emergency Contact" value={member?.emergency_contact_name ? `${member.emergency_contact_name} (${member.emergency_contact_phone || 'No phone'})` : 'Not set'} />
            </>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.85}>
        <LogOut size={20} color={Colors.error[600]} strokeWidth={2} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Icon size={18} color={Colors.neutral[500]} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function EditField({
  label,
  icon: Icon,
  value,
  onChange,
  keyboardType,
  multiline,
}: {
  label: string;
  icon: typeof Mail;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: 'default' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.editField}>
      <View style={styles.editFieldHeader}>
        <Icon size={16} color={Colors.neutral[500]} strokeWidth={2} />
        <Text style={styles.editFieldLabel}>{label}</Text>
      </View>
      <TextInput
        style={[styles.editInput, multiline && { height: 70, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholder="—"
        placeholderTextColor={Colors.neutral[300]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral[50] },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontFamily: FontFamily.display,
    fontSize: 36,
    color: Colors.neutral[0],
  },
  profileName: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: Colors.neutral[0],
    marginBottom: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 8,
  },
  roleText: {
    fontFamily: FontFamily.semibold,
    fontSize: 12,
    color: Colors.neutral[0],
  },
  memberNumber: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.neutral[300],
  },
  section: { padding: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: Colors.neutral[900],
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editButtonText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.primary[700],
  },
  editActions: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: Colors.neutral[0],
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.neutral[400],
    marginBottom: 2,
  },
  infoValue: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: Colors.neutral[900],
  },
  editField: {
    marginBottom: Spacing.md,
  },
  editFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  editFieldLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: Colors.neutral[600],
  },
  editInput: {
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    height: 46,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: Colors.neutral[900],
  },
signOutButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',

  gap: 8,

  marginHorizontal: Spacing.lg,
  marginTop: Spacing.lg,
  marginBottom: 40, // some breathing room

  borderWidth: 1.5,
  borderColor: Colors.error[300],
  borderRadius: BorderRadius.md,

  height: 52,

  backgroundColor: Colors.error[50],
},
  signOutText: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    color: Colors.error[600],
  },
});
