import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const configuredRoots = process.env.UI_AUDIT_ROOTS?.split(path.delimiter).filter(Boolean) ?? ["app", "components"];
const roots = configuredRoots.map((directory) => path.resolve(process.cwd(), directory));
const interactiveNames = new Set([
  "AnimatedButton",
  "AnimatedPressable",
  "Button",
  "Link",
  "PlatformPressable",
  "Pressable",
  "TouchableHighlight",
  "TouchableNativeFeedback",
  "TouchableOpacity",
  "TouchableWithoutFeedback",
]);
// These primitives receive navigation handlers from their framework/consumer
// through props that the local AST cannot resolve.
const forwardingPrimitiveAllowlist = new Set([
  "components/animated-button.tsx",
  "components/haptic-tab.tsx",
]);
const iconNames = new Set(["AntDesign", "Entypo", "Feather", "FontAwesome", "Ionicons", "MaterialCommunityIcons", "MaterialIcons", "Octicons", "SymbolView"]);
const problems = [];

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(target) : target.endsWith(".tsx") ? [target] : [];
  });
}

function attribute(opening, name) {
  return opening.attributes.properties.find((property) => ts.isJsxAttribute(property) && property.name.text === name);
}

function isNoopExpression(expression, definitions, seen = new Set()) {
  if (!expression) return true;
  if (ts.isIdentifier(expression)) {
    if (/^(undefined|noop|noOp)$/i.test(expression.text)) return true;
    if (seen.has(expression.text)) return false;
    const definition = definitions.get(expression.text);
    if (!definition) return false;
    seen.add(expression.text);
    return isNoopExpression(definition, definitions, seen);
  }
  if (ts.isFunctionDeclaration(expression)) return expression.body.statements.length === 0;
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
    if (ts.isBlock(expression.body)) return expression.body.statements.length === 0;
    return expression.body.kind === ts.SyntaxKind.NullKeyword ||
      expression.body.kind === ts.SyntaxKind.FalseKeyword ||
      isNoopExpression(expression.body, definitions, seen);
  }
  if (ts.isCallExpression(expression)) {
    const callee = expression.expression.getText().split(".").at(-1);
    if (["useCallback", "useMemo"].includes(callee ?? "") && expression.arguments[0]) {
      return isNoopExpression(expression.arguments[0], definitions, seen);
    }
  }
  return expression.kind === ts.SyntaxKind.NullKeyword || expression.kind === ts.SyntaxKind.FalseKeyword;
}

function isNoopHandler(handler, definitions) {
  if (!handler?.initializer || !ts.isJsxExpression(handler.initializer)) return false;
  return isNoopExpression(handler.initializer.expression, definitions);
}

for (const file of roots.flatMap(filesIn)) {
  const sourceText = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relative = path.relative(process.cwd(), file);
  const skipInteractiveChecks = forwardingPrimitiveAllowlist.has(relative);
  const definitions = new Map();
  const collectDefinitions = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) definitions.set(node.name.text, node.initializer);
    if (ts.isFunctionDeclaration(node) && node.name) definitions.set(node.name.text, node);
    ts.forEachChild(node, collectDefinitions);
  };
  collectDefinitions(source);
  const report = (node, message) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    problems.push(`${relative}:${line} ${message}`);
  };

  for (const match of sourceText.matchAll(/\b(?:TODO|FIXME)\b/gi)) {
    const line = source.getLineAndCharacterOfPosition(match.index ?? 0).line + 1;
    problems.push(`${relative}:${line} contains TODO/FIXME in visible UI source`);
  }

  function visit(node) {
    if ((ts.isStringLiteralLike(node) || ts.isJsxText(node)) && /coming soon|not implemented|placeholder alert/i.test(node.text)) {
      report(node, `contains placeholder user copy: "${node.text}"`);
    }
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = opening.tagName.getText(source).split(".").at(-1);
      if (!skipInteractiveChecks && tag && interactiveNames.has(tag)) {
        const handler = attribute(opening, "onPress");
        if (!handler && !attribute(opening, "href")) {
          report(opening, `${tag} has no onPress or href`);
        }
        if (isNoopHandler(handler, definitions)) {
          report(opening, `${tag} has an empty, no-op, or undefined onPress`);
        }
        const children = ts.isJsxElement(node) ? node.children.filter((child) => !ts.isJsxText(child) || child.text.trim()) : [];
        const descendantTags = [];
        let hasVisibleText = children.some((child) => ts.isJsxText(child) && Boolean(child.text.trim()));
        for (const child of children) {
          const collect = (descendant) => {
            if (ts.isJsxElement(descendant) || ts.isJsxSelfClosingElement(descendant)) {
              const descendantOpening = ts.isJsxElement(descendant) ? descendant.openingElement : descendant;
              const descendantTag = descendantOpening.tagName.getText(source).split(".").at(-1) ?? "";
              descendantTags.push(descendantTag);
              if (["Text", "ThemedText"].includes(descendantTag)) hasVisibleText = true;
            }
            ts.forEachChild(descendant, collect);
          };
          collect(child);
        }
        const hasIcon = descendantTags.some((name) => iconNames.has(name) || /Icon$/.test(name));
        const iconOnly = hasIcon && !hasVisibleText;
        if (iconOnly && !attribute(opening, "accessibilityLabel")) {
          report(opening, `${tag} appears icon-only but has no accessibilityLabel`);
        }
        const disabled = attribute(opening, "disabled");
        if (disabled && !attribute(opening, "accessibilityState")) {
          report(opening, `${tag} is disabled without accessibilityState`);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

if (problems.length) {
  console.error(`UI interaction audit found ${problems.length} problem(s):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log("UI interaction audit passed.");
