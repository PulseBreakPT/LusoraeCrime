import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "src");
const findings = [];
const metrics = {
  files: 0,
  importantDeclarations: 0,
  hardcodedHexColors: 0,
  backdropEffects: 0,
  infiniteAnimations: 0,
  duplicateSelectors: [],
};

const lineOf = (source, index) => source.slice(0, index).split("\n").length;
const add = (rule, file, source, index, detail, severity = "warning") => {
  findings.push({
    rule,
    severity,
    file: path.relative(process.cwd(), file).replaceAll("\\", "/"),
    line: lineOf(source, index),
    detail: String(detail).replace(/\s+/g, " ").trim().slice(0, 360),
  });
};

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (!/\.(?:js|jsx|css)$/.test(entry.name) || /\.test\./.test(entry.name)) return [];
    return [full];
  });
}

function scanJsx(file, source) {
  for (const match of source.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
    if (Number(match[1]) < 10) add("microtext-under-10px", file, source, match.index, match[0]);
  }

  for (const match of source.matchAll(/transition-all/g)) {
    add("transition-all", file, source, match.index, "Prefer explicit transition properties.");
  }

  for (const match of source.matchAll(/\bconsole\.(?:log|debug|warn)\s*\(/g)) {
    add("console-call", file, source, match.index, match[0], "advisory");
  }

  for (const match of source.matchAll(/\b(?:TODO|FIXME|HACK)\b/g)) {
    add("unfinished-marker", file, source, match.index, match[0], "advisory");
  }

  for (const match of source.matchAll(/<(input|textarea)\b([\s\S]*?)>/g)) {
    const attrs = match[2] || "";
    const cls = attrs.match(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/);
    const classes = cls?.[1] || cls?.[2] || cls?.[3] || "";
    const arbitrary = [...classes.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)].some((m) => Number(m[1]) < 16);
    if (/\btext-(?:xs|sm)\b/.test(classes) || arbitrary) {
      add("small-form-control-text", file, source, match.index, `<${match[1]}> uses "${classes}" — focused controls under 16px can trigger mobile browser zoom.`);
    }
  }

  for (const match of source.matchAll(/<img\b([\s\S]*?)>/g)) {
    if (!/\balt\s*=/.test(match[1] || "")) add("image-missing-alt", file, source, match.index, match[0]);
  }

  for (const match of source.matchAll(/<button\b([\s\S]*?)>([\s\S]*?)<\/button>/g)) {
    const attrs = match[1] || "";
    const body = match[2] || "";
    if (!/\btype\s*=/.test(attrs)) add("button-missing-type", file, source, match.index, match[0].slice(0, 260));

    const readable = body
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\{[^{}]*\}/g, "")
      .replace(/&\w+;/g, "")
      .trim();

    if (!readable && !/\baria-label\s*=|\baria-labelledby\s*=/.test(attrs)) {
      add("icon-button-missing-name", file, source, match.index, match[0].slice(0, 300));
    }
  }

  for (const match of source.matchAll(/\b(?:purple|violet|fuchsia)-\d+/g)) {
    add("non-semantic-purple", file, source, match.index, match[0], "advisory");
  }
}

function scanCss(file, source) {
  metrics.importantDeclarations += (source.match(/!important/g) || []).length;
  metrics.hardcodedHexColors += (source.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
  metrics.backdropEffects += [...source.matchAll(/(?:^|\s)(?:-webkit-)?backdrop-filter\s*:\s*([^;]+);/gm)]
    .filter((match) => match[1].trim() !== "none").length;
  metrics.infiniteAnimations += (source.match(/animation\s*:[^;\n]*\binfinite\b/g) || []).length;

  for (const match of source.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g)) {
    if (Number(match[1]) < 10) add("microtext-under-10px", file, source, match.index, match[0]);
  }
  for (const match of source.matchAll(/transition\s*:[^;]*(?:width|height|padding|margin|top|left|right|bottom)[^;]*;/g)) {
    add("layout-transition", file, source, match.index, match[0]);
  }
  for (const match of source.matchAll(/transition\s*:\s*all\b[^;]*;/g)) {
    add("transition-all", file, source, match.index, match[0]);
  }
  for (const match of source.matchAll(/\b(?:purple|violet|fuchsia)\b/gi)) {
    add("non-semantic-purple", file, source, match.index, match[0], "advisory");
  }

  const selectors = new Map();
  const re = /^\s*([^@\n][^{\n]+)\s*\{\s*$/gm;
  for (const match of source.matchAll(re)) {
    const selector = match[1].trim();
    if (!selector || selector.includes(":root") || selector.startsWith("from") || selector.startsWith("to") || /^\d+%/.test(selector)) continue;
    const arr = selectors.get(selector) || [];
    arr.push(lineOf(source, match.index));
    selectors.set(selector, arr);
  }
  metrics.duplicateSelectors.push(
    ...[...selectors.entries()]
      .filter(([, lines]) => lines.length >= 4)
      .map(([selector, lines]) => ({ file: path.relative(process.cwd(), file).replaceAll("\\", "/"), selector, count: lines.length, lines }))
  );
}

for (const file of walk(root)) {
  metrics.files += 1;
  const source = fs.readFileSync(file, "utf8");
  if (file.endsWith(".css")) scanCss(file, source);
  else scanJsx(file, source);
}

const byRule = findings.reduce((acc, finding) => {
  acc[finding.rule] = (acc[finding.rule] || 0) + 1;
  return acc;
}, {});

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    findingCount: findings.length,
    byRule,
    ...metrics,
    duplicateSelectors: metrics.duplicateSelectors.sort((a, b) => b.count - a.count).slice(0, 40),
  },
  findings,
};

process.stdout.write(JSON.stringify(report, null, 2) + "\n");
process.exitCode = findings.some((finding) => finding.severity === "warning") ? 2 : 0;
