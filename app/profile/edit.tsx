import { Ionicons } from "@expo/vector-icons";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { ProfileAvatar, ProfilePage, profileStyles as styles } from "@/components/profile-ui";
import { ScreenState } from "@/components/screen-state";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { accountGeneration, accountRequestGuard } from "@/services/accountScope";
import { patchProfile, removeAvatar } from "@/services/profileService";
import { discardPickedPhoto, uploadAvatar } from "@/services/privateFiles";
import { AuthContext } from "@/utils/authContext";
import { useProfile } from "@/utils/profileContext";
import { changedProfilePayload, profileForm, PROFILE_GENDERS, validateProfileForm, type ProfileForm } from "@/utils/profileForm";
import { convertWeightString, formatWeightInput, fromKg, loadWeightUnit, type WeightUnit } from "@/utils/weightUnits";

type PhotoEdit = { kind: "keep" } | { kind: "remove" } | { kind: "replace"; uri: string };

export default function EditProfileScreen() {
  const { user } = useContext(AuthContext);
  return <Editor key={`${user?.id ?? ""}:${accountGeneration()}`} />;
}

function Editor() {
  const router = useRouter();
  const navigation = useNavigation();
  const colors = Colors[useColorScheme() ?? "light"];
  const { token, user } = useContext(AuthContext);
  const { profile, avatar, loading, error: loadError, refresh, install } = useProfile();
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [baseline, setBaseline] = useState<ProfileForm | null>(null);
  const [photo, setPhoto] = useState<PhotoEdit>({ kind: "keep" });
  const [genderOpen, setGenderOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const mounted = useRef(true);
  const tempPhotos = useRef(new Set<string>());
  const initialGuard = useRef(accountRequestGuard());
  const current = () => mounted.current && initialGuard.current();
  const dirty = Boolean(form && baseline && (JSON.stringify(changedProfilePayload(form, baseline)) !== "{}" || photo.kind !== "keep"));

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    if (!profile || form) return;
    let cancelled = false;
    void loadWeightUnit().then((unit) => {
      if (cancelled || !initialGuard.current()) return;
      const values = profileForm(profile, unit);
      setForm(values); setBaseline(values);
    });
    return () => { cancelled = true; };
  }, [form, profile]);
  useEffect(() => {
    mounted.current = true;
    const files = tempPhotos.current;
    return () => { mounted.current = false; files.forEach((uri) => { void discardPickedPhoto(uri).catch(() => {}); }); };
  }, []);
  useEffect(() => { if (leaving) router.back(); }, [leaving, router]);
  usePreventRemove(!leaving && current() && (dirty || busy), ({ data }) => {
    if (busy) return;
    if (Platform.OS === "web") {
      if (window.confirm("Discard your unsaved profile changes?")) navigation.dispatch(data.action);
    } else {
      Alert.alert("Discard changes?", "Your unsaved profile changes will be lost.", [{ text: "Keep editing", style: "cancel" }, { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(data.action) }]);
    }
  });

  const update = (key: "preferred_name" | "last_name" | "weight" | "age" | "gender", value: string) => setForm((previous) => previous ? { ...previous, [key]: value, ...(key === "weight" ? { weight_edited: true } : {}) } : previous);
  const changeUnit = (unit: WeightUnit) => setForm((previous) => previous ? { ...previous, weight: !previous.weight_edited && previous.weight_source_kg !== null ? formatWeightInput(fromKg(previous.weight_source_kg, unit)) : convertWeightString(previous.weight, previous.weight_unit, unit), weight_unit: unit } : previous);
  const choosePhoto = async () => {
    setPicking(true); setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
      if (result.canceled) return;
      const asset = result.assets[0];
      tempPhotos.current.add(asset.uri);
      if (!current()) { await discardPickedPhoto(asset.uri); return; }
      const context = ImageManipulator.manipulate(asset.uri);
      context.resize(asset.width >= asset.height ? { width: 512 } : { height: 512 });
      const rendered = await context.renderAsync();
      const normalized = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
      tempPhotos.current.add(normalized.uri);
      await discardPickedPhoto(asset.uri);
      if (!current()) { await discardPickedPhoto(normalized.uri); return; }
      if (photo.kind === "replace") await discardPickedPhoto(photo.uri);
      setPhoto({ kind: "replace", uri: normalized.uri });
    } catch {
      if (current()) setError("Your photo couldn’t be opened. Choose another image or allow photo access in device settings.");
    } finally { if (current()) setPicking(false); }
  };

  const save = async () => {
    if (!form || !baseline || !token || !user || busy) return;
    const validation = validateProfileForm(form, baseline);
    if (validation) { setError(validation); return; }
    setBusy(true); setError(null);
    let detailsSaved = false;
    try {
      const changes = changedProfilePayload(form, baseline);
      if (Object.keys(changes).length) {
        const updated = await patchProfile(token, changes);
        if (!current() || updated.id !== user.id) return;
        const values = profileForm(updated, form.weight_unit);
        setForm(values); setBaseline(values);
        await install(updated);
        detailsSaved = true;
      }
      if (!current()) return;
      if (photo.kind !== "keep") {
        const updated = photo.kind === "remove" ? await removeAvatar(token) : await uploadAvatar(token, photo.uri);
        if (!current() || updated.id !== user.id) return;
        await install(updated);
        if (photo.kind === "replace") await discardPickedPhoto(photo.uri);
        if (!current()) return;
        setPhoto({ kind: "keep" });
      }
      if (current()) setLeaving(true);
    } catch (failure) {
      if (current()) setError(detailsSaved ? "Profile details saved. Your photo couldn’t be updated; your previous photo is still in place. Try Save again." : failure instanceof Error ? failure.message : "Your changes couldn’t be saved. Please try again.");
    } finally { if (current()) setBusy(false); }
  };
  const disabled = busy || picking || !dirty;
  const inputStyle = { color: colors.text, fontSize: 16, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, backgroundColor: colors.inputBackground };

  return <ProfilePage title="Edit Profile" testID="profile-edit-screen" onBack={() => router.back()} action={<Pressable testID="profile-save" onPress={() => void save()} disabled={disabled} accessibilityRole="button" accessibilityLabel="Save profile" accessibilityState={{ disabled, busy }} style={[styles.link, { opacity: disabled ? 0.45 : 1 }]}><ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>{busy ? "Saving…" : "Save"}</ThemedText></Pressable>}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pageContent}>
      {!form || !profile ? <ScreenState colors={colors} kind={loading ? "loading" : "error"} title={loading ? "Loading profile" : "Profile couldn’t load"} message={loadError ?? undefined} actionLabel={loading ? undefined : "Retry"} onAction={() => void refresh()} /> : <>
        <View style={{ alignItems: "center", gap: 12 }}><ProfileAvatar uri={photo.kind === "remove" ? null : photo.kind === "replace" ? photo.uri : avatar} name={[form.preferred_name, form.last_name].join(" ")} size={116} /><View style={{ alignSelf: "stretch", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 26, rowGap: 8 }}><Pressable testID="profile-change-photo" onPress={() => void choosePhoto()} disabled={busy || picking} accessibilityRole="button" accessibilityState={{ disabled: busy || picking, busy: picking }} style={[styles.link, { maxWidth: "100%", opacity: busy || picking ? 0.5 : 1 }]}><ThemedText style={{ color: colors.text, textAlign: "center" }}>{picking ? "Opening photos…" : "Change photo"}</ThemedText></Pressable>{(profile.avatar_version || photo.kind === "replace") && photo.kind !== "remove" ? <Pressable testID="profile-remove-photo" onPress={() => setPhoto({ kind: "remove" })} disabled={busy || picking} accessibilityRole="button" accessibilityState={{ disabled: busy || picking }} style={[styles.link, { maxWidth: "100%" }]}><ThemedText style={{ color: "#E5484D", textAlign: "center" }}>Remove</ThemedText></Pressable> : null}</View></View>
        {error ? <View testID="profile-save-error" accessibilityRole="alert"><ThemedText style={styles.error}>{error}</ThemedText></View> : null}
        <View style={{ gap: 12 }}><ThemedText accessibilityRole="header" style={styles.heading}>Personal details</ThemedText><ThemedText>Preferred name</ThemedText><TextInput testID="profile-preferred-name" accessibilityLabel="Preferred name" style={inputStyle} value={form.preferred_name} onChangeText={(value) => update("preferred_name", value)} maxLength={50} editable={!busy} autoComplete="given-name" /><ThemedText>Last name</ThemedText><TextInput testID="profile-last-name" accessibilityLabel="Last name" style={inputStyle} value={form.last_name} onChangeText={(value) => update("last_name", value)} maxLength={50} editable={!busy} autoComplete="family-name" /><ThemedText>Email</ThemedText><View style={[inputStyle, { flexDirection: "row", alignItems: "center", gap: 12 }]}><ThemedText selectable style={{ flex: 1, color: colors.icon }}>{profile.email}</ThemedText><Ionicons name="lock-closed-outline" size={18} color={colors.icon} /></View><ThemedText style={[styles.muted, { color: colors.icon }]}>Email can’t be changed here.</ThemedText></View>
        <View style={{ gap: 12 }}><ThemedText accessibilityRole="header" style={styles.heading}>Body</ThemedText><ThemedText>Current weight</ThemedText><View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><TextInput testID="profile-weight" accessibilityLabel="Current weight" style={[inputStyle, { flex: 1 }]} value={form.weight} onChangeText={(value) => update("weight", value.replace(",", "."))} keyboardType="decimal-pad" editable={!busy} />{(["LB", "KG"] as const).map((unit) => <Pressable key={unit} testID={`profile-weight-${unit.toLowerCase()}`} onPress={() => changeUnit(unit)} disabled={busy} accessibilityRole="button" accessibilityLabel={`Weight in ${unit === "LB" ? "pounds" : "kilograms"}`} accessibilityState={{ disabled: busy, selected: form.weight_unit === unit }} style={{ minWidth: 44, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: form.weight_unit === unit ? `${colors.primaryButton}18` : "transparent" }}><ThemedText style={{ color: form.weight_unit === unit ? colors.primaryButton : colors.icon, fontWeight: "700" }}>{unit}</ThemedText></Pressable>)}</View><ThemedText>Age</ThemedText><TextInput testID="profile-age" accessibilityLabel="Age" style={inputStyle} value={form.age} onChangeText={(value) => update("age", value)} keyboardType="number-pad" editable={!busy} maxLength={3} /><ThemedText>Gender</ThemedText><Pressable testID="profile-gender" onPress={() => setGenderOpen(!genderOpen)} disabled={busy} accessibilityRole="button" accessibilityLabel="Choose gender" accessibilityState={{ disabled: busy, expanded: genderOpen }} style={[inputStyle, { flexDirection: "row", gap: 12, alignItems: "center" }]}><ThemedText style={{ flex: 1 }}>{form.gender || "Not provided"}</ThemedText><Ionicons name={genderOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.icon} /></Pressable>{genderOpen ? <View style={{ borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 8 }}>{[...PROFILE_GENDERS, ""].map((gender) => <Pressable key={gender} onPress={() => { update("gender", gender); setGenderOpen(false); }} disabled={busy} accessibilityRole="radio" accessibilityState={{ disabled: busy, checked: form.gender === gender }} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}><ThemedText style={{ color: form.gender === gender ? colors.primaryButton : colors.text }}>{gender || "Not provided"}</ThemedText></Pressable>)}</View> : null}<ThemedText style={[styles.muted, { color: colors.icon }]}>Body statistics are optional. Clear a field to remove it.</ThemedText></View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}><Ionicons name="lock-closed-outline" size={16} color={colors.icon} /><ThemedText style={[styles.muted, { color: colors.icon, flex: 1 }]}>Your profile photo and body statistics are private.</ThemedText></View>
        <Pressable onPress={() => router.back()} testID="profile-cancel" disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy }} style={styles.link}><ThemedText style={{ color: colors.text, textAlign: "center" }}>Cancel</ThemedText></Pressable>
      </>}
    </ScrollView></KeyboardAvoidingView>
  </ProfilePage>;
}
