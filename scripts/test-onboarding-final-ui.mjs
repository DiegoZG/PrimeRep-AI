import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import ts from "typescript";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "78c6d0cd1f7a3e182fb19b75b0a8e1e9205286b2";
const route = "app/onboarding/final.tsx";
const source = (file) => readFileSync(path.join(root, file), "utf8");
const original = (file) => execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8" });
const plain = (value) => JSON.parse(JSON.stringify(value));
const hash = (value) => createHash("sha256").update(value).digest("hex");
function load(file, mocks, input = source(file)) {
  const filename = path.join(root, file);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), process: { env: {} }, console: { ...console, warn() {} } }, { filename });
  return module.exports;
}
const native = {
  Pressable: "Pressable", View: "View", Text: "Text", ScrollView: "ScrollView",
  StyleSheet: { create: (value) => value }, Platform: { OS: "ios", select: (values) => values.ios },
};
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node) => flat(node.props.style);
const host = (tree, id) => (tree.root ?? tree).findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const labels = ["Ready to start?", "Create your account to begin your fitness journey", "Create account", "I already have an account"];
const unmount = async (tree) => { await act(async () => tree.unmount()); };
function mocksFor(config, calls, rn = native) {
  const mocks = {
    react: React, "react-native": rn,
    "@/hooks/use-color-scheme": { useColorScheme: () => config.scheme ?? "light" },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: config.bottomInset ?? 34 }) },
    "expo-router": {
      useRouter: () => ({ push: (value) => calls.routes.push(value), back: () => calls.routes.push("BACK") }),
      Stack: { Screen: ({ options }) => { React.useEffect(() => { calls.header = options; }, [options]); return null; } },
    },
    "react-native-reanimated": {
      __esModule: true, default: { createAnimatedComponent: (component) => component },
      useSharedValue: (value) => React.useRef({ value }).current,
      useAnimatedStyle: (callback) => new Proxy({}, { get: (_, key) => callback()[key], ownKeys: () => Reflect.ownKeys(callback()), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) }),
      withSpring: (value, options) => { calls.animations.push([value, options]); return value; },
    },
  };
  for (const [alias, file] of [["@/constants/theme", "constants/theme.ts"], ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"], ["@/components/themed-text", "components/themed-text.tsx"], ["@/components/themed-view", "components/themed-view.tsx"], ["@/components/animated-button", "components/animated-button.tsx"]]) mocks[alias] = load(file, mocks);
  return mocks;
}
async function final(config = {}) {
  const calls = { routes: [], animations: [], reads: [], writes: [], removals: [] };
  const storage = config.storage ?? { value: JSON.stringify({ preferredName: "Alex", varietyLevel: "varied", weightUnit: "KG", selectedEquipment: ["plates"], plateWeights: [5, 10], nested: { retained: true } }) };
  const mocks = mocksFor(config, calls, {
    ...native, useWindowDimensions: () => ({ width: config.width ?? 390, height: 844, fontScale: config.fontScale ?? 1, scale: 3 }),
  });
  mocks["@/utils/authContext"] = { AuthContext: React.createContext({ isBootstrapping: false, isLoggedIn: false }) };
  mocks["@react-native-async-storage/async-storage"] = {
    getItem: async (key) => { calls.reads.push(key); return storage.value; },
    setItem: async (key, value) => { calls.writes.push({ key, value }); storage.value = value; },
    removeItem: async (key) => { calls.removals.push(key); storage.value = null; },
  };
  const { OnboardingContext, OnboardingProvider } = load("utils/onboardingContext.tsx", mocks);
  const { default: Screen } = load(route, mocks, config.original ? original(route) : source(route));
  let context;
  function Restored() {
    context = React.useContext(OnboardingContext);
    return context.isRestoring ? null : React.createElement(Screen);
  }
  let tree;
  await act(async () => { tree = create(React.createElement(OnboardingProvider, null, React.createElement(Restored))); });
  return { tree, calls, storage, data: () => plain(context.getOnboardingData()), colors: mocks["@/constants/theme"].Colors[config.scheme ?? "light"] };
}
for (const scheme of ["light", "dark"]) {
  test(`content: ${scheme} retains all four complete strings without generated copy`, async () => {
    const view = await final({ scheme });
    assert.deepEqual(view.tree.root.findAllByType("Text").map(textOf), labels);
    assert.deepEqual(view.calls.routes, []);
    await unmount(view.tree);
  });
  test(`navigation: ${scheme} original signup and login callbacks preserve restored onboarding data`, async () => {
    const view = await final({ scheme });
    const baseline = await final({ scheme, original: true });
    const before = view.data();
    const writesBefore = view.calls.writes.length;
    for (const [id, destination] of [["onboarding-final-create-account", "/signup"], ["onboarding-final-login", "/login"]]) {
      const node = host(view.tree, id);
      assert.equal(node.props.accessibilityRole, "button");
      assert.equal(node.props.accessibilityLabel, textOf(node));
      for (let index = 0; index < 2; index += 1) await act(async () => node.props.onPress());
      assert.deepEqual(view.calls.routes.slice(-2), [destination, destination]);
    }
    assert.deepEqual(view.data(), before);
    assert.deepEqual(view.data(), baseline.data());
    assert.equal(view.calls.writes.length, writesBefore);
    assert.deepEqual(view.calls.writes, baseline.calls.writes);
    assert.deepEqual(view.calls.removals, []);
    await unmount(view.tree); await unmount(baseline.tree);
  });
  test(`motion: ${scheme} both real shared animated buttons retain original press spring feedback`, async () => {
    const view = await final({ scheme });
    const baseline = await final({ scheme, original: true });
    for (const tree of [view.tree, baseline.tree]) {
      for (const button of tree.root.findAllByType("Pressable")) {
        await act(async () => button.props.onPressIn({ nativeEvent: {} }));
        assert.equal(styleOf(button).transform[0].scale, 0.96);
        await act(async () => button.props.onPressOut({ nativeEvent: {} }));
        assert.equal(styleOf(button).transform[0].scale, 1);
      }
    }
    assert.deepEqual(plain(view.calls.animations), plain(baseline.calls.animations));
    assert.deepEqual(plain(view.calls.animations), [[0.96, { damping: 15, stiffness: 300 }], [1, { damping: 15, stiffness: 300 }], [0.96, { damping: 15, stiffness: 300 }], [1, { damping: 15, stiffness: 300 }]]);
    await unmount(view.tree); await unmount(baseline.tree);
  });
  test(`hierarchy: ${scheme} only Create account uses purple, existing account text stays neutral`, async () => {
    const view = await final({ scheme });
    const primary = host(view.tree, "onboarding-final-create-account");
    const secondary = host(view.tree, "onboarding-final-login");
    assert.equal(styleOf(primary).backgroundColor, view.colors.primaryButton);
    assert.equal(styleOf(primary.findByType("Text")).color, "#FFFFFF");
    assert.equal(styleOf(secondary).backgroundColor, undefined);
    assert.equal(styleOf(secondary.findByType("Text")).color, view.colors.text);
    assert.equal(styleOf(host(view.tree, "onboarding-final-scroll")).backgroundColor, view.colors.background);
    await unmount(view.tree);
  });
  test(`layout: ${scheme} one growing centered scroll contains every string and both account actions`, async () => {
    for (const width of [320, 375, 430]) for (const fontScale of [1, 1.3, 2, 3.1]) for (const bottomInset of [0, 34, 70]) {
      const view = await final({ scheme, width, fontScale, bottomInset });
      assert.equal(view.tree.root.findAllByType("ScrollView").length, 1);
      const scroll = host(view.tree, "onboarding-final-scroll");
      assert.equal(scroll.props.contentInsetAdjustmentBehavior, "automatic");
      assert.equal(styleOf(scroll).flex, 1);
      const content = flat(scroll.props.contentContainerStyle);
      assert.equal(content.flexGrow, 1);
      assert.equal(content.justifyContent, "center");
      assert.equal(content.paddingHorizontal, 32);
      assert.equal(content.paddingTop, 24);
      assert.equal(content.paddingBottom, Math.max(24, bottomInset));
      assert.deepEqual(scroll.findAllByType("Text").map(textOf), labels);
      for (const id of ["onboarding-final-create-account", "onboarding-final-login"]) assert.ok(host(scroll, id));
      for (const node of scroll.findAll((node) => typeof node.type === "string")) {
        const style = styleOf(node);
        for (const property of ["height", "maxHeight", "position"]) assert.equal(style[property], undefined, `${node.type} ${property}`);
        assert.notEqual(style.overflow, "hidden");
        if (node.type === "Text") for (const property of ["allowFontScaling", "maxFontSizeMultiplier", "numberOfLines", "ellipsizeMode", "adjustsFontSizeToFit"]) assert.equal(node.props[property], undefined, property);
      }
      const title = host(scroll, "onboarding-final-title");
      assert.equal(styleOf(title).fontSize, 32);
      assert.equal(styleOf(title).lineHeight, 40);
      assert.equal(styleOf(title).width, "100%");
      for (const [id, minimum] of [["onboarding-final-create-account", 56], ["onboarding-final-login", 44]]) {
        const button = host(scroll, id);
        assert.equal(styleOf(button).minHeight, minimum);
        assert.equal(styleOf(button).width, "100%");
        assert.equal(styleOf(button.findByType("Text")).textAlign, "center");
        assert.equal(styleOf(button.findByType("Text")).lineHeight, 24);
      }
      await unmount(view.tree);
    }
  });
  test(`header: ${scheme} removes only redundant Skip and leaves inherited Back options intact`, async () => {
    const view = await final({ scheme });
    assert.deepEqual(Object.keys(view.calls.header), ["headerRight"]);
    assert.equal(view.calls.header.headerRight(), null);
    for (const key of ["headerLeft", "headerBackVisible", "headerShown", "headerTitle", "gestureEnabled"]) assert.equal(view.calls.header[key], undefined);
    await unmount(view.tree);
  });
  test(`persistence: ${scheme} route exit and re-entry keep the original restored account snapshot`, async () => {
    const first = await final({ scheme });
    const before = first.data();
    await act(async () => host(first.tree, "onboarding-final-login").props.onPress());
    await unmount(first.tree);
    const second = await final({ scheme, storage: first.storage });
    assert.deepEqual(second.data(), before);
    assert.deepEqual(second.calls.routes, []);
    assert.deepEqual(second.calls.removals, []);
    assert.deepEqual(second.calls.reads, ["primerep.onboardingDraft.v1"]);
    await unmount(second.tree);
  });
  test(`web: ${scheme} actual RN-web renders two named keyboard-accessible account buttons`, () => {
    const rn = createRequire(import.meta.url)("react-native-web");
    const mocks = mocksFor({ scheme }, { routes: [], animations: [] }, rn);
    const { default: Screen } = load(route, mocks);
    const html = renderToStaticMarkup(React.createElement(Screen));
    for (const [id, label] of [["onboarding-final-create-account", "Create account"], ["onboarding-final-login", "I already have an account"]]) {
      const tag = html.match(new RegExp(`<[^>]*data-testid="${id}"[^>]*>`))?.[0];
      assert.ok(tag, html);
      assert.match(tag, /role="button"/);
      assert.ok(tag.includes(`aria-label="${label}"`));
      assert.match(tag, /tabindex="0"/);
    }
    for (const label of labels) assert.ok(html.includes(label));
    assert.equal((html.match(/role="button"/g) ?? []).length, 2);
  });
}
test("scope: existing Final controller and two navigation handlers stay byte-identical", () => {
  const controller = (input) => {
    const normalized = input.replace("  const insets = useSafeAreaInsets();\n", "");
    return normalized.slice(normalized.indexOf("const OnboardingFinalScreen = () => {"), normalized.indexOf("\n  return ("));
  };
  assert.equal(controller(source(route)), controller(original(route)));
  const handlers = (input) => Array.from(input.matchAll(/onPress=\{(.*?)\}/g), (match) => match[1]);
  assert.deepEqual(handlers(source(route)), handlers(original(route)));
  assert.deepEqual(handlers(source(route)), ['() => router.push("/signup")', '() => router.push("/login")']);
});
test("scope: shared onboarding behavior is unchanged apart from the registered workout exercise picker", () => {
  const picker = '          <Stack.Screen name="workout/exercise-picker" options={{ headerShown: false }} />\n';
  assert.equal(source("app/_layout.tsx").split(picker).length, 2);
  for (const file of ["components/animated-button.tsx", "components/themed-text.tsx", "components/themed-view.tsx", "constants/theme.ts", "hooks/use-theme-color.ts", "hooks/use-color-scheme.ts", "utils/onboardingContext.tsx", "utils/authContext.tsx", "app/_layout.tsx", "app/onboarding/_layout.tsx", "app/signup.tsx", "app/login.tsx", "package.json", "package-lock.json", "app.json"]) assert.equal(file === "app/_layout.tsx" ? source(file).replace(picker, "") : source(file), original(file), file);
  assert.equal(hash(source("utils/onboardingContext.tsx")), "4e8d1c2948f77152251971d444ef527291609b58f0e9f12bc3a361e5828a994a");
});
