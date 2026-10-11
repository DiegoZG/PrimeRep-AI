import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import ts from "typescript";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function load(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console }, { filename });
  return module.exports;
}
const native = { ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", View: "View", Text: "Text", TextInput: "TextInput", ScrollView: "ScrollView", KeyboardAvoidingView: "KeyboardAvoidingView", TouchableWithoutFeedback: "TouchableWithoutFeedback", StyleSheet: { create: (styles) => styles }, Platform: { OS: "ios", select: (values) => values.ios } };
const { Colors } = load("constants/theme.ts", { "react-native": native });
const units = load("utils/weightUnits.ts", { "@react-native-async-storage/async-storage": { getItem: async () => "LB" } });
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node, pressed = false) => flat(typeof node.props.style === "function" ? node.props.style({ pressed }) : node.props.style);
const textOf = (node) => typeof node === "string" ? node : (node?.children?.map(textOf).join(" ") ?? "").replace(/\s+/g, " ").trim();
const host = (tree, id) => tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const press = async (view, id) => { const action = host(view.tree, id); assert.ok(action, id); assert.equal(action.props.disabled ?? false, false, id); await act(async () => action.props.onPress()); };
const type = async (view, id, value) => { await act(async () => host(view.tree, id).props.onChangeText(value)); };
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
const session = (extra = {}) => ({ id: "session-A", status: "completed", workoutNote: "", summary: { title: "Lower A", completedSetCount: 2 }, exerciseFeedback: [],
  workoutSnapshot: { exerciseBlocks: [{ items: [{ exercise: { id: "bridge", name: "Glute Bridge" }, prescription: { sets: 4 } }, { exercise: { id: "squat", name: "Squat" }, prescription: { sets: 2 } }] }] },
  setLogs: [{ id: "one", exerciseId: "bridge", setNumber: 1, reps: 10, weightKg: 20, version: 3 }, { id: "two", exerciseId: "bridge", setNumber: 2, reps: 6, weightKg: null, version: 1 }],
  deletedSetLogs: [{ id: "four", exerciseId: "bridge", setNumber: 4, reps: 5, weightKg: 30, version: 2 }], ...extra });
class HttpError extends Error { constructor(message, status) { super(message); this.status = status; } }
function contrast(a, b) {
  const luminance = (hex) => (hex.length === 4 ? hex.slice(1).split("").map((value) => value.repeat(2)) : hex.slice(1).match(/../g)).map((value) => parseInt(value, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const [x, y] = [luminance(a), luminance(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
async function correctionView(scheme, { response = session(), unit = "LB", width = 375, fontScale = 1, handlers = {} } = {}) {
  const colors = Colors[scheme], AuthContext = React.createContext(null), RouteContext = React.createContext("session-A");
  let server = response, counter = 0, keyboardDismissals = 0, backs = 0;
  const calls = [], alerts = [];
  const defaults = {
    getSession: async () => server,
    logSet: async (_token, _id, exerciseId, setNumber, reps, weightKg) => { const created = { id: "added", exerciseId, setNumber, reps, weightKg: weightKg ?? null, version: 1 }; server = { ...server, setLogs: [...server.setLogs, created] }; return created; },
    updateLoggedSet: async (_token, _id, logId, reps, weightKg) => { const updated = { ...server.setLogs.find((set) => set.id === logId), reps, weightKg, version: 4 }; server = { ...server, setLogs: server.setLogs.map((set) => set.id === logId ? updated : set) }; return updated; },
    deleteLoggedSet: async (_token, _id, logId) => { const removed = server.setLogs.find((set) => set.id === logId); server = { ...server, setLogs: server.setLogs.filter((set) => set.id !== logId), deletedSetLogs: [...server.deletedSetLogs, removed] }; },
    restoreLoggedSet: async (_token, _id, logId) => { const restored = server.deletedSetLogs.find((set) => set.id === logId); server = { ...server, setLogs: [...server.setLogs, restored], deletedSetLogs: server.deletedSetLogs.filter((set) => set.id !== logId) }; return restored; },
    updateWorkoutNote: async (_token, _id, note) => { server = { ...server, workoutNote: note }; return server; },
  };
  const service = Object.fromEntries(Object.keys(defaults).map((name) => [name, (...args) => { calls.push({ name, args }); return (handlers[name] ?? defaults[name])(...args); }]));
  const mocks = { react: React, "react-native": { ...native, useWindowDimensions: () => ({ width, fontScale }), Keyboard: { dismiss: () => keyboardDismissals++ }, Alert: { alert: (...args) => alerts.push(args) } }, "@expo/vector-icons": { Ionicons: "Ionicons" }, "@/constants/theme": { Colors }, "@/hooks/use-theme-color": { useThemeColor: () => colors.text } };
  const { ThemedText } = load("components/themed-text.tsx", mocks);
  const { WorkoutText } = load("components/workout/WorkoutText.tsx", { ...mocks, "@/components/themed-text": { ThemedText } });
  const { default: Screen } = load("app/workout/history/[sessionId].tsx", { ...mocks, "@/components/workout/WorkoutText": { WorkoutText }, "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "expo-router": { useRouter: () => ({ back: () => backs++ }), useLocalSearchParams: () => ({ sessionId: React.useContext(RouteContext) }) },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" }, "@/utils/authContext": { AuthContext }, "@/utils/weightUnits": { ...units, loadWeightUnit: async () => unit },
    "@/utils/activeWorkoutStore": { createClientId: () => `operation-${++counter}` }, "@/services/httpClient": { HttpError }, "@/services/workoutLoggingService": service,
  });
  const element = ({ account = "A", route = "session-A" } = {}) => React.createElement(AuthContext.Provider, { value: { token: `token-${account}`, user: { id: account } } }, React.createElement(RouteContext.Provider, { value: route }, React.createElement(Screen)));
  let tree; await act(async () => { tree = create(element()); });
  return { tree, element, calls, alerts, handlers, defaults, setServer: (value) => { server = value; }, get keyboardDismissals() { return keyboardDismissals; }, get backs() { return backs; } };
}

for (const scheme of ["light", "dark"]) {
  const colors = Colors[scheme];
  test(`${scheme}: neutral saved rows, semantic icons and actual 44-point actions`, async () => {
    const view = await correctionView(scheme);
    const card = host(view.tree, "history-exercise-bridge");
    assert.equal(styleOf(card).backgroundColor, colors.inputBackground);
    assert.equal(card.findAllByType("Ionicons").find((node) => node.props.name === "create-outline").props.color, colors.icon);
    const saved = card.findAllByType("Ionicons").find((node) => node.props.name === "checkmark-done-outline");
    assert.ok(contrast(saved.props.color, colors.inputBackground) >= 3);
    assert.match(host(view.tree, "history-logged-set-one").props.accessibilityLabel, /Saved set 1/);
    assert.match(textOf(host(view.tree, "history-logged-set-two")), /Bodyweight × 6/);
    for (const id of ["history-edit-set-one", "history-remove-set-one", "history-add-set-bridge", "history-restore-slot-bridge-4", "history-save-note", "history-back"]) {
      const action = host(view.tree, id), style = styleOf(action);
      assert.ok((style.minHeight ?? style.height) >= 44, id);
      assert.equal(action.props.accessibilityRole, "button"); assert.ok(action.props.accessibilityLabel);
      assert.ok(styleOf(action, true).opacity < style.opacity || styleOf(action, true).backgroundColor !== style.backgroundColor, id);
      if (id === "history-save-note") for (const pressed of [false, true]) assert.ok(contrast("#FFFFFF", styleOf(action, pressed).backgroundColor) >= 4.5);
    }
    assert.equal(styleOf(host(view.tree, "history-add-set-bridge").findByType("Text")).color, colors.text);
    assert.ok(contrast(host(view.tree, "history-remove-set-one").findByType("Ionicons").props.color, colors.inputBackground) >= 3);
    await press(view, "history-back"); assert.equal(view.backs, 1); assert.equal(view.calls.length, 1);
    await act(async () => view.tree.unmount());
  });

  test(`${scheme}: all snapshot exercises, zero sets, deleted slots and legacy logs stay visible`, async () => {
    const view = await correctionView(scheme, { response: session({ setLogs: [...session().setLogs.reverse(), { id: "legacy", exerciseId: "legacy", setNumber: 7, reps: 3, weightKg: 10, version: 1 }] }) });
    assert.match(textOf(host(view.tree, "history-exercise-squat")), /Squat No sets logged yet/);
    assert.ok(host(view.tree, "history-add-set-squat"));
    assert.match(textOf(host(view.tree, "history-exercise-bridge")), /Set 1.*Set 2/);
    assert.equal(host(view.tree, "history-add-set-bridge").props.accessibilityLabel, "Add set 3 for Glute Bridge");
    assert.ok(host(view.tree, "history-restore-slot-bridge-4"));
    assert.equal(host(view.tree, "history-add-set-legacy"), undefined);
    await act(async () => view.tree.unmount());
  });

  test(`${scheme}: adaptive labeled fields, natural long text and local Cancel never persist`, async () => {
    for (const size of [{ width: 375, fontScale: 1, direction: "row" }, { width: 320, fontScale: 1, direction: "column" }, { width: 375, fontScale: 3, direction: "column" }]) {
      const view = await correctionView(scheme, { ...size, response: session({ summary: { title: "A long workout title that wraps naturally" }, workoutNote: "A long saved workout note that stays available in an expanded input." }) });
      const header = host(view.tree, "history-header");
      if (size.direction === "column") {
        assert.equal(header.findAllByType("Text").length, 0);
        assert.ok(host(view.tree, "history-content").findAll((node) => typeof node.type === "string" && node.props.testID === "history-heading").length);
      } else assert.match(textOf(header), /A long workout title/);
      assert.equal(styleOf(host(view.tree, "history-back")).minHeight, 44);
      await press(view, "history-edit-set-one");
      assert.equal(styleOf(host(view.tree, "history-edit-fields-one")).flexDirection, size.direction);
      for (const id of ["history-edit-weight-one", "history-edit-reps-one"]) assert.ok(styleOf(host(view.tree, id)).minHeight >= 48);
      assert.equal(host(view.tree, "history-edit-weight-one").props.value, "44.1");
      await type(view, "history-edit-weight-one", "55"); await press(view, "history-cancel-edit-one");
      assert.match(textOf(host(view.tree, "history-logged-set-one")), /44.1 lb/);
      await press(view, "history-add-set-bridge");
      assert.equal(styleOf(host(view.tree, "history-add-fields-bridge")).flexDirection, size.direction);
      await type(view, "history-add-reps-bridge", "8"); await press(view, "history-cancel-add-bridge");
      assert.equal(view.calls.length, 1);
      for (const text of view.tree.root.findAllByType("Text")) { assert.equal(text.props.numberOfLines, undefined); assert.equal(text.props.maxFontSizeMultiplier, undefined); assert.equal(styleOf(text).lineHeight, undefined); }
      await act(async () => view.tree.unmount());
    }
  });

  test(`${scheme}: first-tap Save and outside/drag dismissal retain native input handling`, async () => {
    const view = await correctionView(scheme);
    const scroll = host(view.tree, "history-scroll"), content = host(view.tree, "history-content");
    assert.equal(scroll.props.keyboardShouldPersistTaps, "always"); assert.equal(scroll.props.keyboardDismissMode, "interactive");
    assert.equal(view.tree.root.findByType("KeyboardAvoidingView").props.behavior, "padding");
    content.props.onTouchEnd({ target: 2, currentTarget: 1 }); assert.equal(view.keyboardDismissals, 0);
    content.props.onTouchEnd({ target: 1, currentTarget: 1 }); assert.equal(view.keyboardDismissals, 1);
    for (const background of view.tree.root.findAllByType("TouchableWithoutFeedback")) assert.equal(background.props.accessible, false);
    await type(view, "history-workout-note", "  A note  "); await press(view, "history-save-note");
    assert.equal(view.keyboardDismissals, 2); assert.equal(view.calls.find((call) => call.name === "updateWorkoutNote").args[2], "A note");
    assert.ok(host(view.tree, "history-note-saved"));
    await act(async () => view.tree.unmount());
  });

  test(`${scheme}: add validates, converts LB/KG, accepts bodyweight and reuses stable retries`, async () => {
    for (const unit of ["LB", "KG"]) {
      let attempt = 0;
      const view = await correctionView(scheme, { unit, handlers: { logSet: async (...args) => { if (++attempt === 1) throw new Error("offline"); return { id: "added", exerciseId: args[2], setNumber: args[3], reps: args[4], weightKg: args[5], version: 1 }; } } });
      await press(view, "history-add-set-bridge"); await type(view, "history-add-reps-bridge", "1.5"); await press(view, "history-save-added-set-bridge");
      assert.ok(host(view.tree, "history-add-set-error")); assert.equal(view.calls.filter((call) => call.name === "logSet").length, 0);
      await type(view, "history-add-reps-bridge", "8"); await type(view, "history-add-weight-bridge", "100"); await press(view, "history-save-added-set-bridge");
      assert.match(textOf(host(view.tree, "history-add-set-error")), /Retry to safely/);
      assert.equal(host(view.tree, "history-add-reps-bridge").props.editable, false);
      await press(view, "history-save-added-set-bridge");
      const logged = view.calls.filter((call) => call.name === "logSet");
      assert.equal(logged.length, 2); assert.deepEqual(logged[0].args, logged[1].args);
      assert.equal(logged[0].args[5], unit === "LB" ? 45.359237 : 100);
      assert.equal(host(view.tree, "history-add-reps-bridge"), undefined);
      await act(async () => view.tree.unmount());
    }
    const blank = await correctionView(scheme); await press(blank, "history-add-set-squat"); await type(blank, "history-add-reps-squat", "6"); await press(blank, "history-save-added-set-squat");
    assert.equal(blank.calls.find((call) => call.name === "logSet").args[5], undefined);
    assert.match(textOf(host(blank.tree, "history-logged-set-added")), /Bodyweight × 6/);
    await act(async () => blank.tree.unmount());
  });

  test(`${scheme}: a conflicting add reloads the canonical slot instead of another write`, async () => {
    const view = await correctionView(scheme, { handlers: { logSet: async () => { throw new HttpError("slot occupied", 409); } } });
    await press(view, "history-add-set-bridge"); await type(view, "history-add-reps-bridge", "8"); await press(view, "history-save-added-set-bridge");
    assert.equal(view.calls.filter((call) => call.name === "getSession").length, 2);
    assert.equal(view.calls.filter((call) => call.name === "logSet").length, 1);
    assert.equal(host(view.tree, "history-add-reps-bridge"), undefined); assert.equal(view.alerts.at(-1)[0], "Set already logged");
    await act(async () => view.tree.unmount());
  });

  test(`${scheme}: edits retain exact stored weight/version, validation, optimistic rollback and conflict reload`, async () => {
    const view = await correctionView(scheme);
    await press(view, "history-edit-set-one"); await type(view, "history-edit-reps-one", "0"); await press(view, "history-save-set-one");
    assert.equal(view.alerts.at(-1)[0], "Invalid set"); assert.ok(host(view.tree, "history-edit-reps-one"));
    await type(view, "history-edit-reps-one", "9"); await press(view, "history-save-set-one");
    const saved = view.calls.find((call) => call.name === "updateLoggedSet"); assert.equal(saved.args[4], 20); assert.equal(saved.args[5], 3); assert.ok(saved.args[6]);
    view.handlers.updateLoggedSet = async () => { throw new Error("offline"); };
    await press(view, "history-edit-set-one"); await type(view, "history-edit-reps-one", "12"); await press(view, "history-save-set-one");
    assert.match(textOf(host(view.tree, "history-logged-set-one")), /× 9/); assert.equal(view.alerts.at(-1)[0], "Couldn’t save correction");
    view.handlers.updateLoggedSet = async () => { throw new HttpError("changed", 409); };
    await press(view, "history-edit-set-one"); await type(view, "history-edit-reps-one", "12"); await press(view, "history-save-set-one");
    assert.equal(view.alerts.at(-1)[0], "Set updated elsewhere"); assert.match(textOf(host(view.tree, "history-logged-set-one")), /× 9/);
    await act(async () => view.tree.unmount());
    for (const unit of ["LB", "KG"]) {
      const converted = await correctionView(scheme, { unit }); await press(converted, "history-edit-set-one");
      await type(converted, "history-edit-weight-one", "-1"); await press(converted, "history-save-set-one"); assert.equal(converted.alerts.at(-1)[0], "Invalid set");
      await type(converted, "history-edit-weight-one", "100"); await press(converted, "history-save-set-one");
      assert.equal(converted.calls.find((call) => call.name === "updateLoggedSet").args[4], unit === "LB" ? 45.359237 : 100);
      await press(converted, "history-edit-set-one"); await type(converted, "history-edit-weight-one", ""); await press(converted, "history-save-set-one");
      assert.equal(converted.calls.at(-1).args[4], null); assert.match(textOf(host(converted.tree, "history-logged-set-one")), /Bodyweight/);
      await act(async () => converted.tree.unmount());
    }
  });

  test(`${scheme}: pending set saves disable repeat actions and do not announce optimistic values as saved`, async () => {
    const pending = deferred(); const view = await correctionView(scheme, { handlers: { updateLoggedSet: () => pending.promise } });
    await press(view, "history-edit-set-one"); await type(view, "history-edit-reps-one", "12"); await press(view, "history-save-set-one");
    assert.equal(host(view.tree, "history-edit-set-one").props.disabled, true); assert.equal(host(view.tree, "history-remove-set-one").props.disabled, true);
    assert.equal(host(view.tree, "history-edit-set-one").props.accessibilityState.busy, true);
    assert.match(host(view.tree, "history-logged-set-one").props.accessibilityLabel, /Saving correction to set 1/);
    assert.match(textOf(host(view.tree, "history-exercise-bridge")), /Saving correction/);
    assert.equal(host(view.tree, "history-exercise-bridge").findAllByType("Ionicons").find((node) => node.props.name === "checkmark-done-outline").props.color, colors.icon);
    assert.equal(host(view.tree, "history-header").props.onTouchEnd({ target: 2, currentTarget: 1 }), undefined);
    const before = view.keyboardDismissals; host(view.tree, "history-header").props.onTouchEnd({ target: 1, currentTarget: 1 }); assert.equal(view.keyboardDismissals, before + 1);
    await act(async () => pending.resolve({ ...session().setLogs[0], reps: 12, version: 4 }));
    assert.match(host(view.tree, "history-logged-set-one").props.accessibilityLabel, /Saved set 1/);
    assert.equal(view.calls.filter((call) => call.name === "updateLoggedSet").length, 1);
    await act(async () => view.tree.unmount());
    const adding = deferred(); const newSet = await correctionView(scheme, { handlers: { logSet: () => adding.promise } });
    await press(newSet, "history-add-set-squat"); await type(newSet, "history-add-reps-squat", "6"); await press(newSet, "history-save-added-set-squat");
    assert.equal(host(newSet.tree, "history-save-added-set-squat").props.disabled, true); assert.equal(host(newSet.tree, "history-cancel-add-squat").props.disabled, true);
    assert.equal(host(newSet.tree, "history-add-reps-squat").props.editable, false);
    await act(async () => adding.resolve({ id: "new-bodyweight", exerciseId: "squat", setNumber: 1, reps: 6, weightKg: null, version: 1 }));
    assert.equal(newSet.calls.filter((call) => call.name === "logSet").length, 1);
    await act(async () => newSet.tree.unmount());
  });

  test(`${scheme}: Remove confirmation, Undo and saved deleted-slot Restore preserve APIs`, async () => {
    const view = await correctionView(scheme); await press(view, "history-remove-set-one");
    const buttons = view.alerts.at(-1)[2]; assert.equal(buttons[0].style, "cancel"); assert.equal(buttons[1].style, "destructive");
    assert.equal(view.calls.filter((call) => call.name === "deleteLoggedSet").length, 0);
    await act(async () => buttons[1].onPress()); assert.equal(host(view.tree, "history-logged-set-one"), undefined);
    const undo = host(view.tree, "history-restore-set-one"); assert.ok(styleOf(undo).minHeight >= 44); assert.equal(styleOf(undo.findByType("Text")).color, colors.text);
    await press(view, "history-restore-set-one"); assert.ok(host(view.tree, "history-logged-set-one"));
    await press(view, "history-restore-slot-bridge-4"); assert.ok(host(view.tree, "history-logged-set-four"));
    assert.equal(view.calls.filter((call) => call.name === "restoreLoggedSet").length, 2);
    await act(async () => view.tree.unmount());
    const failed = await correctionView(scheme, { handlers: { deleteLoggedSet: async () => { throw new Error("offline"); }, restoreLoggedSet: async () => { throw new Error("offline"); } } });
    await press(failed, "history-remove-set-one"); await act(async () => failed.alerts.at(-1)[2][1].onPress());
    assert.equal(failed.alerts.at(-1)[0], "Couldn’t remove set"); assert.ok(host(failed.tree, "history-logged-set-one"));
    await press(failed, "history-restore-slot-bridge-4"); assert.equal(failed.alerts.at(-1)[0], "Couldn’t restore set"); assert.ok(host(failed.tree, "history-restore-slot-bridge-4"));
    await act(async () => failed.tree.unmount());
  });

  test(`${scheme}: failed note save retains the draft and accessible retry with honest states`, async () => {
    const pending = deferred(); const view = await correctionView(scheme, { handlers: { updateWorkoutNote: () => pending.promise } });
    await type(view, "history-workout-note", "Draft must remain"); await press(view, "history-save-note");
    assert.equal(host(view.tree, "history-save-note").props.disabled, true); assert.equal(host(view.tree, "history-workout-note").props.editable, false);
    assert.ok(host(view.tree, "history-note-saving")); await act(async () => pending.reject(new Error("offline")));
    assert.equal(host(view.tree, "history-workout-note").props.value, "Draft must remain"); assert.equal(host(view.tree, "history-note-error").props.accessibilityRole, "alert");
    assert.ok(contrast(styleOf(host(view.tree, "history-note-error")).color, colors.inputBackground) >= 4.5);
    delete view.handlers.updateWorkoutNote; await press(view, "history-save-note"); assert.ok(host(view.tree, "history-note-saved"));
    assert.equal(styleOf(host(view.tree, "history-note-saved")).color, colors.icon);
    await type(view, "history-workout-note", "  "); await press(view, "history-save-note"); assert.equal(view.calls.at(-1).args[2], null);
    await act(async () => view.tree.unmount());
  });

  test(`${scheme}: account/route changes hide stale loads and fence delayed note/add responses`, async () => {
    const initial = deferred(); const view = await correctionView(scheme, { handlers: { getSession: () => initial.promise } });
    view.handlers.getSession = async () => session({ id: "session-B", summary: { title: "Account B workout" } });
    await act(async () => view.tree.update(view.element({ account: "B", route: "session-B" })));
    await act(async () => initial.resolve(session())); assert.match(textOf(host(view.tree, "history-header")), /Account B workout/); assert.doesNotMatch(textOf(host(view.tree, "history-header")), /Lower A/);
    await act(async () => view.tree.unmount());
    for (const name of ["updateWorkoutNote", "logSet", "updateLoggedSet"]) {
      const pending = deferred(); const fenced = await correctionView(scheme, { handlers: { [name]: () => pending.promise } });
      if (name === "logSet") { await press(fenced, "history-add-set-bridge"); await type(fenced, "history-add-reps-bridge", "8"); await press(fenced, "history-save-added-set-bridge"); }
      else if (name === "updateLoggedSet") { await press(fenced, "history-edit-set-one"); await type(fenced, "history-edit-reps-one", "99"); await press(fenced, "history-save-set-one"); }
      else { await type(fenced, "history-workout-note", "Account A draft"); await press(fenced, "history-save-note"); }
      fenced.handlers.getSession = async () => session({ id: "session-B", workoutNote: "Account B note" });
      await act(async () => fenced.tree.update(fenced.element({ account: "B", route: "session-B" })));
      await act(async () => pending.resolve(name === "logSet" ? { id: "old-result", exerciseId: "bridge", setNumber: 3, reps: 8, weightKg: 2 } : name === "updateLoggedSet" ? { ...session().setLogs[0], reps: 99 } : session({ workoutNote: "Account A saved" })));
      assert.equal(host(fenced.tree, "history-workout-note").props.value, "Account B note"); assert.equal(host(fenced.tree, "history-logged-set-old-result"), undefined);
      assert.match(textOf(host(fenced.tree, "history-logged-set-one")), /× 10/);
      assert.equal(fenced.calls.filter((call) => call.name === name).length, 1);
      await act(async () => fenced.tree.unmount());
    }
  });

  test(`${scheme}: loading/retry, abandoned read-only and feedback retain their truthful contracts`, async () => {
    const view = await correctionView(scheme, { handlers: { getSession: async () => { throw new Error("offline"); } } });
    assert.ok(host(view.tree, "history-retry-load")); assert.equal(styleOf(host(view.tree, "history-retry-load").findByType("Text")).color, colors.text);
    delete view.handlers.getSession; await press(view, "history-retry-load"); assert.ok(host(view.tree, "history-header")); await act(async () => view.tree.unmount());
    const abandoned = await correctionView(scheme, { response: session({ status: "abandoned", exerciseFeedback: [{ exerciseId: "bridge", effort: "hard", rir: 2 }] }) });
    assert.match(textOf(host(abandoned.tree, "history-header")), /Abandoned — read only/);
    for (const id of ["history-edit-set-one", "history-remove-set-one", "history-add-set-bridge", "history-restore-slot-bridge-4", "history-save-note"]) assert.equal(host(abandoned.tree, id), undefined);
    assert.equal(host(abandoned.tree, "history-workout-note").props.editable, false); assert.match(textOf(abandoned.tree.toJSON()), /Glute Bridge\s*: hard · 2 RIR/);
    await act(async () => abandoned.tree.unmount());
  });
}
