import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import ts from "typescript";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const filename = path.join(root, "components/workout/SetInputRow.tsx");
const palette = { background: "#fff", inputBackground: "#fff", inputBorder: "#E5E5E5", text: "#11181C", placeholder: "#9BA1A6" };
const SwipeableMock = React.forwardRef((props, ref) => {
  const methods = { openRight: () => props.onSwipeableWillOpen?.("right"),
    close: () => { props.onSwipeableWillClose?.("right"); props.onSwipeableClose?.("right"); } };
  React.useImperativeHandle(ref, () => methods);
  return React.createElement("Swipeable", props, props.children, props.renderRightActions?.({ value: 0 }, { value: 0 }, methods));
});
SwipeableMock.displayName = "SwipeableMock";
const mocks = {
  react: React,
  "@expo/vector-icons": { Ionicons: "Ionicons" },
  "react-native": { View: "View", TextInput: "TextInput", Pressable: "Pressable", Modal: "Modal", Keyboard: { dismiss() {} } },
  "react-native-gesture-handler/ReanimatedSwipeable": { __esModule: true, default: SwipeableMock },
  "@/components/workout/WorkoutText": { WorkoutText: "WorkoutText" },
  "@/constants/theme": { Colors: { dark: { background: "#151718" } }, Fonts: { sans: "system-ui" } },
};
const module = { exports: {} };
const source = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
vm.runInNewContext(source, { module, exports: module.exports, require: (name) => {
  if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
  return mocks[name];
} }, { filename });
const { SetInputRow } = module.exports;
const base = { exerciseId: "squat", setNumber: 1, weight: "40", reps: "8", confirmed: false, syncStatus: "synced" };

for (const [name, fields, label] of [
  ["empty", { weight: "", reps: "" }, "Not logged yet"],
  ["suggested", {}, "Suggested values. Not logged yet"],
  ["edited", { hasUnsavedInput: true }, "Unsaved changes"],
  ["saved", { confirmed: true }, "Saved and synced"],
  ["pending", { confirmed: true, syncStatus: "pending" }, "Saved on this device. Pending sync"],
  ["retrying", { confirmed: true, syncStatus: "retrying" }, "Pending sync"],
  ["failed", { confirmed: true, syncStatus: "failed" }, "Sync failed"],
  ["editing saved", { confirmed: true, editing: true, hasUnsavedInput: true }, "Unsaved changes"],
]) test(`${name} set centers its number and announces status in both themes`, async () => {
  for (const background of ["#fff", "#151718"]) {
    let tree;
    let confirmed = null;
    await act(async () => { tree = create(React.createElement(SetInputRow, {
      setRow: { ...base, ...fields }, colors: { ...palette, background }, weightUnit: "LB", lastTimeHint: "40 lb × 8",
      onUpdate() {}, onConfirm: (number) => { confirmed = number; }, onEdit() {}, onRemove() {}, onRestore() {}, onRetry() {},
    })); });
    const setNumber = tree.root.findByProps({ testID: "player-set-number-squat-1" });
    assert.ok(setNumber.props.accessibilityLabel.includes(label));
    assert.equal(setNumber.props.accessibilityRole, "text");
    assert.equal(setNumber.parent.props.style.justifyContent, "center");
    assert.equal(setNumber.parent.findAllByType("Ionicons").length, 0);
    assert.ok(!tree.root.findAllByType("WorkoutText").some((text) => /Suggested|Unsaved|Logged/.test(String(text.props.children))));
    const button = tree.root.findByProps({ testID: fields.confirmed && !fields.editing ? "player-set-menu-squat-1" : "player-confirm-set-squat-1" });
    assert.equal(button.findByType("Ionicons").props.name, "checkmark");
    assert.equal(button.findByType("Ionicons").parent.props.style.backgroundColor, fields.confirmed && !fields.editing ? "#237858" : palette.inputBackground);
    assert.equal(button.findByType("Ionicons").props.color, fields.confirmed && !fields.editing ? "#FFFFFF" : palette.text);
    if (name === "failed") {
      assert.equal(tree.root.findByProps({ testID: "player-retry-set-squat-1" }).props.accessibilityRole, "button");
      assert.equal(tree.root.findByProps({ testID: "player-set-menu-squat-1" }).props.disabled, true);
    }
    if (name === "edited") {
      await act(async () => tree.root.findByProps({ testID: "player-confirm-set-squat-1" }).props.onPress());
      assert.equal(confirmed, 1);
      assert.ok(tree.root.findAllByType("WorkoutText").some((text) => String(text.props.children).includes("Last time")));
    }
    await act(async () => tree.unmount());
  }
});

test("a logged row keeps its input borders and previous-result height", async () => {
  let tree;
  const props = { setRow: base, colors: palette, weightUnit: "LB", lastTimeHint: "40 lb × 8", compact: true,
    onUpdate() {}, onConfirm() {}, onEdit() {}, onRemove() {}, onRestore() {}, onRetry() {} };
  await act(async () => { tree = create(React.createElement(SetInputRow, props)); });
  const inputBefore = tree.root.findByProps({ testID: "player-weight-input-squat-1" });
  const hintBefore = tree.root.findAllByType("WorkoutText").find((node) => String(node.props.children).includes("Last time:"));
  assert.equal(inputBefore.props.style.borderWidth, 1);
  assert.equal(hintBefore.props.style.opacity, 1);
  await act(async () => tree.update(React.createElement(SetInputRow, { ...props, setRow: { ...base, confirmed: true } })));
  const inputAfter = tree.root.findByProps({ testID: "player-weight-input-squat-1" });
  const hintAfter = tree.root.findAllByType("WorkoutText").find((node) => String(node.props.children).includes("Last time:"));
  assert.equal(inputAfter.props.style.borderWidth, inputBefore.props.style.borderWidth);
  assert.equal(hintAfter.props.style.lineHeight, hintBefore.props.style.lineHeight);
  assert.equal(hintAfter.props.style.opacity, 0);
  await act(async () => tree.unmount());
});

test("an empty added set offers removal until the user enters a value", async () => {
  let removed = null;
  let confirmed = null;
  let tree;
  const props = { setRow: { ...base, setNumber: 5, isAdded: true, weight: "", reps: "" }, colors: palette,
    weightUnit: "LB", compact: true, onUpdate() {}, onConfirm: (number) => { confirmed = number; }, onEdit() {},
    onRemove: (number) => { removed = number; }, onRestore() {}, onRetry() {} };
  await act(async () => { tree = create(React.createElement(SetInputRow, props)); });
  const menu = tree.root.findByProps({ testID: "player-set-menu-squat-5" });
  assert.equal(menu.props.accessibilityLabel, "Actions for set 5");
  assert.ok(menu.props.style.width >= 44);
  await act(async () => menu.props.onPress());
  assert.equal(tree.root.findByProps({ testID: "player-set-actions-squat-5" }).props.accessibilityElementsHidden, false);
  const remove = tree.root.findByProps({ testID: "player-remove-set-squat-5" });
  assert.equal(remove.props.accessibilityLabel, "Remove set 5");
  await act(async () => remove.props.onPress());
  assert.equal(removed, 5);
  assert.equal(confirmed, null);
  await act(async () => tree.update(React.createElement(SetInputRow, { ...props, setRow: { ...props.setRow, reps: "8" } })));
  assert.equal(tree.root.findAllByProps({ testID: "player-set-menu-squat-5" }).length, 0);
  const logButton = tree.root.findByProps({ testID: "player-confirm-set-squat-5" });
  assert.equal(logButton.props.accessibilityActions[0].name, "showSetActions");
  await act(async () => logButton.props.onAccessibilityAction({ nativeEvent: { actionName: "showSetActions" } }));
  assert.equal(tree.root.findByProps({ testID: "player-set-actions-squat-5" }).props.accessibilityElementsHidden, false);
  await act(async () => tree.unmount());
});

test("saved check and swipe reveal the same inline Edit and Remove actions without a modal", async () => {
  const chosen = [];
  let tree;
  await act(async () => { tree = create(React.createElement(SetInputRow, { setRow: { ...base, confirmed: true },
    colors: palette, weightUnit: "LB", onUpdate() {}, onConfirm() {}, onEdit: () => chosen.push("edit"),
    onRemove: () => chosen.push("remove"), onRestore() {}, onRetry() {} })); });
  const swipeable = tree.root.findByType("Swipeable");
  assert.equal(tree.root.findAllByType("Modal").length, 0);
  assert.equal(tree.root.findByProps({ testID: "player-set-actions-squat-1" }).props.accessibilityElementsHidden, true);
  await act(async () => tree.root.findByProps({ testID: "player-set-menu-squat-1" }).props.onPress());
  assert.equal(tree.root.findByProps({ testID: "player-set-actions-squat-1" }).props.accessibilityElementsHidden, false);
  await act(async () => tree.root.findByProps({ testID: "player-edit-set-squat-1" }).props.onPress());
  assert.deepEqual(chosen, ["edit"]);
  await act(async () => swipeable.props.onSwipeableWillOpen("right"));
  await act(async () => tree.root.findByProps({ testID: "player-remove-set-squat-1" }).props.onPress());
  assert.deepEqual(chosen, ["edit", "remove"]);
  await act(async () => tree.unmount());
});
