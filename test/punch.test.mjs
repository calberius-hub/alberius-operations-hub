// test/punch.test.mjs — run with:  node test/punch.test.mjs
//
// Covers the rules that lose data silently when broken. No Netlify, no
// network: punch-core.mjs is pure on purpose so this stays a plain Node run.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import {
  mergeUnit, summarize, unitId, photoId, isComplete, TOTAL_ITEMS,
} from "../netlify/functions/punch-core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
let failures = 0;
function ok(label, cond) {
  if (!cond) failures++;
  console.log((cond ? "PASS  " : "FAIL  ") + label);
}

/* ── The checklist and the server must agree on how many checks there are ──
   punch-data.js is a browser file, so evaluate it the way a browser would. */
const dataSrc = readFileSync(join(here, "..", "punch-data.js"), "utf8");
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(dataSrc + "\n;globalThis.__rooms = ROOMS;", sandbox);
const rooms = sandbox.__rooms;
const counted = rooms.reduce(
  (n, r) => n + r.cats.reduce((m, c) => m + c.items.length, 0), 0);

ok("punch-data.js still has " + TOTAL_ITEMS + " checks (found " + counted + ")",
   counted === TOTAL_ITEMS);
ok("every room id is unique",
   new Set(rooms.map((r) => r.id)).size === rooms.length);

/* ── Two managers in one unit ── */
let u = mergeUnit(null, { unit: "A", inspector: "Randy", createdAt: 1000, updatedAt: 2000,
  items: { "guest-bed.0.1": { status: "fail", note: "switch dead", photos: ["p1"], t: 2000 },
           "kitchen.1.0":   { status: "pass", t: 2000 } } });
u = mergeUnit(u, { unit: "A", inspector: "Josh", updatedAt: 3000,
  items: { "guest-bed.0.1": { status: "pass", note: "STALE", t: 1500 },
           "foyer.0.0":     { status: "fail", note: "hanging light", t: 3000 } } });
ok("stale edit loses",        u.items["guest-bed.0.1"].note === "switch dead");
ok("newer edit wins",         u.items["foyer.0.0"].status === "fail");
ok("other phone's work kept", u.items["kitchen.1.0"].status === "pass");
ok("both inspectors kept",    JSON.stringify(u.inspectors) === '["Randy","Josh"]');

/* ── An equal stamp must never let an older client erase a newer field ── */
let e = mergeUnit(null, { unit: "E", items: { a: { status: "fail", t: 100 } } });
e = mergeUnit(e, { unit: "E", items: { a: { status: "fail", fixed: true, fixedBy: "Cole",
  verified: true, verifiedAt: 5, verifiedBy: "Cole", t: 500 } } });
e = mergeUnit(e, { unit: "E", items: { a: { status: "fail", t: 500 } } });   // stale echo
ok("equal-stamp echo cannot erase a sign-off",
   e.items.a.fixed === true && e.items.a.verified === true);

/* ── The two-stage closeout ── */
let v = mergeUnit(null, { unit: "V", items: { a: { status: "fail", t: 100 } } });
ok("starts open", summarize(v).fail === 1);
v = mergeUnit(v, { unit: "V", items: { a: { status: "fail", fixed: true, fixedBy: "Randy", t: 200 } } });
ok("fixed moves to toVerify", summarize(v).toVerify === 1 && summarize(v).fail === 0);
v = mergeUnit(v, { unit: "V", items: { a: { status: "fail", fixed: true, fixedBy: "Randy",
  verified: true, verifiedBy: "Cole", t: 300 } } });
ok("verify closes it out", summarize(v).verified === 1 && summarize(v).toVerify === 0);
ok("both signers recorded", v.items.a.fixedBy === "Randy" && v.items.a.verifiedBy === "Cole");
v = mergeUnit(v, { unit: "V", items: { a: { status: "fail", fixed: false, t: 900 } } });
ok("reopening clears the sign-off",
   v.items.a.verified === false && v.items.a.verifiedBy === "" && summarize(v).fail === 1);

let w = mergeUnit(null, { unit: "W", items: { b: { status: "fail", verified: true, verifiedBy: "X", t: 1 } } });
ok("cannot verify what nobody fixed", w.items.b.verified === false && summarize(w).fail === 1);

let legacy = mergeUnit(null, { unit: "L", items: { d: { status: "fail", fixed: true, t: 1 } } });
ok("pre-verification data reads as toVerify", summarize(legacy).toVerify === 1);

/* ── Hostile input ── */
ok("path traversal stripped", unitId("../../etc/passwd") === "etcpasswd");
ok("photo id sanitised",      photoId("../x/y") === "xy");
ok("note truncated",
   mergeUnit(null, { unit: "x", items: { k: { status: "fail", note: "z".repeat(5000), t: 1 } } })
     .items.k.note.length === 2000);
ok("photos capped",
   mergeUnit(null, { unit: "x", items: { k: { status: "fail", photos: Array(50).fill("p"), t: 1 } } })
     .items.k.photos.length === 12);
ok("bogus status nulled",
   mergeUnit(null, { unit: "x", items: { k: { status: "hacked", t: 1 } } }).items.k.status === null);

/* ── Completion, which is what triggers the office email ── */
const full = { unit: "F", items: {} };
for (let i = 0; i < TOTAL_ITEMS - 1; i++) full.items["i" + i] = { status: "pass", t: 1 };
ok("one short is not complete", !isComplete(full));
full.items["last"] = { status: "fail", t: 1 };
ok("all answered is complete",  isComplete(full));
ok("open failures still count as complete", summarize(full).fail === 1);
const withFixed = { unit: "G", items: JSON.parse(JSON.stringify(full.items)) };
withFixed.items["last"] = { status: "fail", fixed: true, verified: true, t: 1 };
ok("a verified unit is complete too", isComplete(withFixed));

console.log(failures ? "\n" + failures + " FAILED" : "\nall good");
process.exit(failures ? 1 : 0);
