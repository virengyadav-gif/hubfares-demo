/**
 * Builds the specimen PAN card and Aadhaar card images used to demonstrate onboarding autofill, plus the
 * registry the extractor uses to recognise them. Static data: no real identity, no live extraction.
 * Run: npm run fixtures:samples   (output is committed; the app reads the PNGs + registry, not this script)
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const DIR = path.resolve('fixtures/documents');
const PUBLIC_DIR = path.resolve('public/samples');

const css = `*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif}body{background:#fff}
.card{position:relative;width:860px;height:540px;border-radius:26px;overflow:hidden;padding:34px 40px;color:#1d2433}
.wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(-24deg);font-size:96px;font-weight:900;letter-spacing:12px;color:rgba(200,30,30,.13);pointer-events:none}
.lbl{font-size:15px;color:#4b5565;letter-spacing:.5px;text-transform:uppercase}.val{font-size:27px;font-weight:700;margin-top:3px}
.photo{width:150px;height:180px;border-radius:12px;background:linear-gradient(160deg,#cfd6e3,#9aa6ba);display:flex;align-items:flex-end;justify-content:center;overflow:hidden}
.head{width:70px;height:70px;border-radius:50%;background:#7d889c;margin-bottom:-6px;position:relative;top:-40px}.body{position:absolute;width:120px;height:80px;border-radius:60px 60px 0 0;background:#7d889c;bottom:0}
.tag{display:inline-block;padding:5px 14px;border-radius:999px;font-size:14px;font-weight:700;letter-spacing:1px}`;

const PAN = `<div class="card" style="background:linear-gradient(135deg,#e8f1fb 0%,#d4e4f6 55%,#c2d7ef 100%)">
 <div class="wm">SPECIMEN</div>
 <div style="display:flex;justify-content:space-between;align-items:center">
  <div><div style="font-size:30px;font-weight:800;color:#163a6b">PERMANENT ACCOUNT NUMBER CARD</div><div style="font-size:15px;color:#3a5376;margin-top:4px">Sample card for onboarding demonstration</div></div>
  <span class="tag" style="background:#163a6b;color:#fff">SPECIMEN</span></div>
 <div style="margin-top:34px;display:flex;gap:34px">
  <div style="flex:1">
   <div class="lbl">Permanent Account Number</div><div class="val" style="font-size:40px;letter-spacing:4px;font-family:'Courier New',monospace">AAKCB0777B</div>
   <div style="margin-top:22px" class="lbl">Name</div><div class="val">BLUEBIRD TRAVELS PRIVATE LIMITED</div>
   <div style="margin-top:22px;display:flex;gap:60px"><div><div class="lbl">Date of Incorporation</div><div class="val">01/04/2021</div></div><div><div class="lbl">Entity</div><div class="val">Company</div></div></div>
  </div></div>
 <div style="position:absolute;bottom:26px;left:40px;right:40px;display:flex;justify-content:space-between;font-size:14px;color:#3a5376"><span>Specimen document — not valid for any purpose</span><span>HF-SAMPLE-PAN-01</span></div>
</div>`;

const AADHAAR = `<div class="card" style="background:linear-gradient(180deg,#fff7ec 0%,#ffffff 46%,#eef8ef 100%)">
 <div class="wm">SPECIMEN</div>
 <div style="height:10px;background:linear-gradient(90deg,#f59a3a,#ffffff,#3aa55c);border-radius:6px"></div>
 <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">
  <div><div style="font-size:30px;font-weight:800;color:#8a3d06">AADHAAR — SPECIMEN</div><div style="font-size:15px;color:#6b5a48;margin-top:4px">Sample identity card for onboarding demonstration</div></div>
  <span class="tag" style="background:#8a3d06;color:#fff">SPECIMEN</span></div>
 <div style="margin-top:26px;display:flex;gap:34px">
  <div class="photo" style="position:relative"><div class="head"></div><div class="body"></div></div>
  <div style="flex:1">
   <div class="lbl">Name</div><div class="val">Riya Kulkarni</div>
   <div style="margin-top:14px;display:flex;gap:56px"><div><div class="lbl">Date of Birth</div><div class="val">14/08/1988</div></div><div><div class="lbl">Gender</div><div class="val">Female</div></div></div>
   <div style="margin-top:14px" class="lbl">Address</div><div class="val" style="font-size:21px;line-height:1.35">14 Riverside Plaza, Koregaon Park,<br/>Pune, Maharashtra - 411001</div>
  </div></div>
 <div style="margin-top:26px;text-align:center;font-size:44px;font-weight:800;letter-spacing:10px;font-family:'Courier New',monospace">XXXX XXXX 4821</div>
 <div style="position:absolute;bottom:22px;left:40px;right:40px;display:flex;justify-content:space-between;font-size:14px;color:#6b5a48"><span>Masked specimen — no complete identity number</span><span>HF-SAMPLE-AADHAAR-01</span></div>
</div>`;

function withMarker(png: Buffer, marker: string): Buffer {
  // Insert a tEXt chunk right after IHDR so the extractor can recognise the specimen even if renamed.
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const data = Buffer.from(`Comment\0${marker}`, 'latin1');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from('tEXt'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  const ihdrEnd = 8 + 4 + 4 + 13 + 4;
  return Buffer.concat([png.subarray(0, ihdrEnd), len, td, c, png.subarray(ihdrEnd)]);
}

(async () => {
  void zlib;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 580 }, deviceScaleFactor: 1.5 });
  const out: any[] = [];
  const shots: [string, string, string, string, Record<string, [string, number]>][] = [
    ['sample-pan-card.png', PAN, 'HUBFARES-SAMPLE-PAN', 'PAN', { pan: ['AAKCB0777B', 0.98], agencyName: ['Bluebird Travels', 0.93], entityType: ['PRIVATE_LIMITED', 0.9] }],
    ['sample-aadhaar-card.png', AADHAAR, 'HUBFARES-SAMPLE-AADHAAR', 'IDENTITY_MASKED', { directorName: ['Riya Kulkarni', 0.97], directorSalutation: ['Ms', 0.9], maskedId: ['XXXX XXXX 4821', 0.98], addressLine1: ['14 Riverside Plaza, Koregaon Park', 0.92], city: ['Pune', 0.97], state: ['Maharashtra', 0.97], postalCode: ['411001', 0.97], country: ['India', 0.95] }],
  ];
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  for (const [file, html, marker, documentType, fields] of shots) {
    await page.setContent(`<html><head><style>${css}</style></head><body style="padding:20px">${html}</body></html>`);
    const buf = withMarker(await page.locator('.card').screenshot({ type: 'png' }), marker);
    fs.writeFileSync(path.join(DIR, file), buf);
    fs.writeFileSync(path.join(PUBLIC_DIR, file), buf);
    out.push({ file, marker, documentType, sha256: createHash('sha256').update(buf).digest('hex'), fields: Object.entries(fields).map(([name, [value, confidence]]) => ({ name, value, confidence })) });
  }
  await browser.close();
  fs.writeFileSync(path.join(DIR, 'sample-documents.json'), JSON.stringify({ note: 'Specimen ID cards recognised by fingerprint or embedded marker; values are static (no live extraction).', samples: out }, null, 2) + '\n');
  console.log(`Built ${out.length} specimen cards`);
})();
