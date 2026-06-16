#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

const distIndex = path.resolve(process.cwd(), "dist", "index.html");

const fail = (msg) => {
  console.error(`check-csp: ${msg}`);
  process.exit(1);
};

const html = await readFile(distIndex, "utf8").catch((error) => {
  fail(`cannot read ${distIndex} — ${error.message}`);
});

if (!/<meta[^>]+http-equiv="Content-Security-Policy"/i.test(html)) {
  fail("missing <meta http-equiv=\"Content-Security-Policy\"> in dist/index.html");
}

if (!/<meta[^>]+http-equiv="Permissions-Policy"[^>]+usb=\(self\)/i.test(html)) {
  fail("missing Permissions-Policy meta with usb=(self)");
}

const scriptTags = [...html.matchAll(/<script\b[^>]*\bsrc="[^"]+"[^>]*>/gi)].map((m) => m[0]);
const linkTags = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/gi)].map((m) => m[0]);

const missingScriptSri = scriptTags.filter((tag) => !/\bintegrity="sha384-[^"]+"/i.test(tag));
const missingLinkSri = linkTags.filter((tag) => !/\bintegrity="sha384-[^"]+"/i.test(tag));

if (missingScriptSri.length > 0) {
  fail(`script tag(s) missing SRI integrity:\n${missingScriptSri.join("\n")}`);
}

if (missingLinkSri.length > 0) {
  fail(`stylesheet link(s) missing SRI integrity:\n${missingLinkSri.join("\n")}`);
}

console.log(`check-csp: OK (${scriptTags.length} scripts, ${linkTags.length} stylesheets, all signed)`);
