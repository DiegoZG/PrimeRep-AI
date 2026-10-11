import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function load(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console }, { filename });
  return module.exports;
}
const flatStyle = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const textOf = (node) => node.findAllByType('Text').map((text) => text.children.join('')).join('');
const constants = load('features/onboarding/constants.ts');
const { Colors } = load('constants/theme.ts', { 'react-native': { Platform: { select: (values) => values.ios } } });
function contrast(foreground, background) {
  function luminance(hex) {
    const normalized = hex.length === 4 ? '#' + [...hex.slice(1)].map((value) => value + value).join('') : hex;
    const values = normalized.slice(1).match(/../g).map((value) => parseInt(value, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
  }
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
async function renderCalculator({ scheme = 'light', unit = 'LB', exercise, canGoBack = true } = {}) {
  const OnboardingContext = React.createContext(null);
  const writes = [];
  let backs = 0;
  let dismissals = 0;
  const { default: Calculator } = load('app/onboarding/fitness-experience/calculator-modal.tsx', {
    react: React,
    'expo-router': { useLocalSearchParams: () => ({ exercise }), router: { canGoBack: () => canGoBack, back: () => { backs += 1; } } },
    'react-native': { Keyboard: { dismiss: () => { dismissals += 1; } }, KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'ios' }, ScrollView: 'ScrollView', StyleSheet: { create: (styles) => styles, absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } }, Text: 'Text', TouchableOpacity: 'TouchableOpacity', TouchableWithoutFeedback: 'TouchableWithoutFeedback', View: 'View' },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, useAnimatedStyle: (callback) => callback(), useSharedValue: (value) => ({ value }), withDelay: (_delay, value) => value, withTiming: (value) => value },
    '@/components/animated-button': { AnimatedButton: 'AnimatedButton' },
    '@/components/animated-input': { AnimatedInput: 'AnimatedInput' },
    '@/components/themed-view': { ThemedView: 'ThemedView' },
    '@/constants/theme': { Colors, Fonts: { sans: 'system-ui' } },
    '@/hooks/use-color-scheme': { useColorScheme: () => scheme },
    '@/utils/onboardingContext': { OnboardingContext },
    '@/features/onboarding/constants': constants,
  });
  let tree;
  await act(async () => { tree = create(React.createElement(OnboardingContext.Provider, { value: { data: { weightUnit: unit }, updateField: (...args) => writes.push(args) } }, React.createElement(Calculator))); });
  const byId = (id) => tree.root.findByProps({ testID: id });
  const enter = async (reps, weight) => { await act(async () => { byId('calculator-reps-input').props.onChangeText(reps); byId('calculator-weight-input').props.onChangeText(weight); }); };
  const press = async (id) => { await act(async () => { byId(id).props.onPress(); }); };
  return { tree, byId, enter, press, writes, backs: () => backs, dismissals: () => dismissals };
}

for (const scheme of ['light', 'dark']) {
  test(`Calculator action hierarchy and contrast in ${scheme}`, async () => {
    const { tree, byId, enter, press } = await renderCalculator({ scheme });
    const colors = Colors[scheme];
    assert.equal(byId('calculator-calculate').props.disabled, true);
    assert.equal(byId('calculator-calculate').props.accessibilityState.disabled, true);
    assert.equal(tree.root.findAllByProps({ testID: 'calculator-apply' }).length, 0);
    await enter('5', '100.5');
    assert.equal(byId('calculator-calculate').props.disabled, false);
    assert.equal(flatStyle(byId('calculator-calculate').props.style).backgroundColor, colors.primaryButton);
    assert.ok(contrast('#FFFFFF', colors.primaryButton) >= 4.5);
    await press('calculator-calculate');
    assert.equal(flatStyle(byId('calculator-calculate').props.style).backgroundColor, colors.inputBackground);
    assert.equal(flatStyle(byId('calculator-calculate').findByType('Text').props.style).color, colors.text);
    assert.equal(tree.root.findAllByProps({ testID: 'calculator-apply' }).length, 0);
    assert.equal(flatStyle(byId('calculator-result').props.style).backgroundColor, colors.background);
    assert.equal(flatStyle(byId('calculator-result-value').props.style).color, colors.text);
    assert.equal(byId('calculator-result-value').children.join(''), '113 lb');
    await press('calculator-exercise-bench-press');
    assert.equal(byId('calculator-exercise-bench-press').props.accessibilityState.selected, true);
    assert.equal(byId('calculator-exercise-deadlift').props.accessibilityState.selected, false);
    assert.equal(flatStyle(byId('calculator-exercise-bench-press').findByType('Text').props.style).color, colors.text);
    const apply = byId('calculator-apply');
    assert.equal(flatStyle(apply.props.style).backgroundColor, colors.primaryButton);
    assert.ok(contrast(flatStyle(apply.findByType('Text').props.style).color, flatStyle(apply.props.style).backgroundColor) >= 4.5);
    assert.ok(contrast(colors.icon, colors.inputBackground) >= 4.5);
    assert.ok(contrast(colors.text, colors.background) >= 4.5);
    for (const id of ['calculator-calculate', 'calculator-apply', 'calculator-cancel', ...constants.ONE_REP_MAX_SCREEN.exercises.map((exercise) => `calculator-exercise-${exercise.id}`)]) {
      assert.ok(flatStyle(byId(id).props.style).minHeight >= 44, id);
      assert.equal(byId(id).props.accessibilityRole, 'button');
    }
    await act(async () => { tree.unmount(); });
  });

  for (const unit of ['LB', 'KG']) {
    for (const [exercise, field] of [['bench-press', 'benchPress1RM'], ['back-squat', 'backSquat1RM'], ['deadlift', 'deadlift1RM']]) {
      test(`Calculator decimal ${unit} result applies to ${field} in ${scheme}`, async () => {
        const { tree, byId, enter, press, writes, backs } = await renderCalculator({ scheme, unit, exercise });
        await enter('5', '100.5');
        await press('calculator-calculate');
        assert.equal(byId('calculator-result-value').children.join(''), `113 ${unit.toLowerCase()}`);
        assert.equal(textOf(byId('calculator-apply')), `Apply 113 ${unit.toLowerCase()} to ${constants.ONE_REP_MAX_SCREEN.exercises.find((item) => item.id === exercise).name}`);
        await press('calculator-apply');
        assert.deepEqual(writes, [[field, 113]]);
        assert.equal(backs(), 1);
        await act(async () => { tree.unmount(); });
      });
    }
  }
}

test('Invalid calculation clears result without applying; boundary reps preserve formula', async () => {
  const { tree, byId, enter, press, writes } = await renderCalculator({ exercise: 'deadlift' });
  for (const reps of ['1', '30']) {
    await enter(reps, '100.5');
    await press('calculator-calculate');
    assert.equal(byId('calculator-result-value').children.join(''), `${constants.calculateOneRepMax(100.5, Number(reps))} lb`);
  }
  for (const [reps, weight] of [['0', '100.5'], ['31', '100.5'], ['5', '0'], ['x', '100.5']]) {
    await enter(reps, weight);
    await press('calculator-calculate');
    assert.equal(tree.root.findAllByProps({ testID: 'calculator-result' }).length, 0);
    assert.equal(tree.root.findAllByProps({ testID: 'calculator-apply' }).length, 0);
    assert.equal(flatStyle(byId('calculator-calculate').props.style).backgroundColor, Colors.light.primaryButton);
  }
  assert.deepEqual(writes, []);
  await act(async () => { tree.unmount(); });
});

test('Input edits keep the last estimate until recalculation; Cancel and backdrop do not write', async () => {
  const { tree, byId, enter, press, writes, backs } = await renderCalculator({ exercise: 'bench-press' });
  await enter('5', '100.5');
  await press('calculator-calculate');
  await enter('6', '120');
  assert.equal(byId('calculator-result-value').children.join(''), '113 lb');
  await press('calculator-calculate');
  assert.equal(byId('calculator-result-value').children.join(''), '140 lb');
  await press('calculator-dismiss');
  assert.equal(backs(), 1);
  assert.deepEqual(writes, []);
  await act(async () => { tree.unmount(); });
});

test('Direct modal entry without a back destination does not expose a dead Cancel action', async () => {
  const { tree, byId, writes, backs } = await renderCalculator({ canGoBack: false, unit: undefined });
  assert.equal(tree.root.findAllByProps({ testID: 'calculator-cancel' }).length, 0);
  assert.equal(byId('calculator-dismiss').props.onPress, undefined);
  assert.equal(backs(), 0);
  assert.deepEqual(writes, []);
  await act(async () => { tree.unmount(); });
});

test('Named fields, scrolling and Cancel preserve keyboard and return contracts', async () => {
  const { tree, byId, enter, press, writes, backs, dismissals } = await renderCalculator();
  assert.equal(byId('calculator-reps-input').props.accessibilityLabel, 'Reps');
  assert.equal(byId('calculator-weight-input').props.accessibilityLabel, 'Weight in lb');
  for (const id of ['calculator-reps-input', 'calculator-weight-input']) {
    assert.equal(byId(id).props.keyboardType, 'numeric');
    assert.ok(flatStyle(byId(id).props.style).minHeight >= 44);
    assert.equal(byId(id).props.maxFontSizeMultiplier, undefined);
  }
  const scroll = tree.root.findByType('ScrollView');
  assert.equal(scroll.props.keyboardShouldPersistTaps, 'handled');
  assert.equal(scroll.props.keyboardDismissMode, 'on-drag');
  assert.equal(flatStyle(tree.root.findByType('AnimatedView').props.style).maxHeight, '100%');
  assert.equal(tree.root.findByType('AnimatedView').props.accessibilityViewIsModal, true);
  await act(async () => { tree.root.findByType('TouchableWithoutFeedback').props.onPress(); });
  assert.equal(dismissals(), 1);
  await enter('5', '100.5');
  await press('calculator-calculate');
  assert.equal(dismissals(), 2);
  await press('calculator-cancel');
  assert.equal(backs(), 1);
  assert.deepEqual(writes, []);
  await act(async () => { tree.unmount(); });
});
