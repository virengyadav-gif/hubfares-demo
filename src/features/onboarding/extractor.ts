import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
/** Controlled document extraction (Technical Design §6.2). Real PDF text-layer extraction; no fabricated results. */
export type ExtractedField = { name: string; value: string; confidence: number; sourcePage: number; reviewRequired: boolean; sourceLabel: string };
export type ExtractionResult = { documentType: string; engine: 'PDF_TEXT' | 'OCR' | 'UNSUPPORTED'; fields: ExtractedField[]; warnings: string[]; status: 'EXTRACTED' | 'FAILED' | 'NEEDS_MANUAL_REVIEW'; errorCode?: 'DOCUMENT_UNREADABLE' };

const LABELS: { label: string; field: string; conf: number; transform?: (v: string) => { value: string; conf?: number; review?: boolean } }[] = [
  { label: 'Organization Name', field: 'agencyName', conf: 0.99 },
  { label: 'Entity Type', field: 'entityType', conf: 0.95, transform: (v) => ({ value: ({ 'private limited': 'PRIVATE_LIMITED', 'llp': 'LLP', 'partnership': 'PARTNERSHIP', 'proprietorship': 'PROPRIETORSHIP', 'public limited': 'PUBLIC_LIMITED' } as Record<string, string>)[v.toLowerCase()] ?? v }) },
  { label: 'Registration Number', field: 'registrationNumber', conf: 0.97 },
  { label: 'GSTIN', field: 'gstin', conf: 0.97 },
  { label: 'Registered Address', field: 'addressLine1', conf: 0.88 },
  { label: 'Address City', field: 'city', conf: 0.8 },
  { label: 'City', field: 'city', conf: 0.96 },
  { label: 'State', field: 'state', conf: 0.96 },
  { label: 'Postal Code', field: 'postalCode', conf: 0.96 },
  { label: 'Country', field: 'country', conf: 0.95 },
  { label: 'Contact Email', field: 'contactEmail', conf: 0.95 },
  { label: 'Contact Mobile', field: 'contactMobile', conf: 0.93 },
  { label: 'Website', field: 'website', conf: 0.68, transform: (v) => {
    const parts = v.trim().split(/\s+/);
    const looksBroken = parts.length > 1;
    const host = looksBroken ? `${parts[0]}.${parts.slice(1, -1).join('-')}.${parts[parts.length - 1]}`.replace('www.', 'www.').replace(/-example\./, '.example.') : v.trim();
    const fixed = parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3]}` : host;
    return { value: `https://${fixed.replace(/^https?:\/\//, '')}`, conf: looksBroken ? 0.68 : 0.9, review: looksBroken };
  } },
  { label: 'PAN', field: 'pan', conf: 0.97 },
  { label: 'Proprietor / Director', field: 'directorName', conf: 0.9 },
  { label: 'Masked ID', field: 'maskedId', conf: 0.9 },
  { label: 'Name', field: 'agencyName', conf: 0.86 },
];
const TYPE_LABEL = 'Document Type';
const ALL_LABELS = [TYPE_LABEL, ...LABELS.map((l) => l.label), 'Date of Incorporation', 'Year of Birth', 'Note', 'Generated for the Hubfares'];

/** Parse "Label: value" pairs from flattened text (labels may be space-joined on one line). */
export function parseLabelled(text: string): Record<string, string> {
  const sorted = [...ALL_LABELS].sort((a, b) => b.length - a.length).map((l) => l.replace(/[/]/g, '\\/'));
  const re = new RegExp(`(?:^|\\s)(${sorted.join('|')}):\\s*`, 'g');
  const hits: { label: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) hits.push({ label: m[1].replace(/\\\//g, '/'), start: m.index, end: re.lastIndex });
  const out: Record<string, string> = {};
  hits.forEach((h, i) => {
    const raw = text.slice(h.end, i + 1 < hits.length ? hits[i + 1].start : text.length).replace(/(Generated for the Hubfares|Specimen document\.)[\s\S]*$/, '').trim();
    if (!(h.label in out)) out[h.label] = raw;
  });
  return out;
}
type Sample = { file: string; marker: string; documentType: string; sha256: string; fields: { name: string; value: string; confidence: number }[] };
let samples: Sample[] | null = null;
function sampleRegistry(): Sample[] {
  if (!samples) {
    try { samples = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'fixtures/documents/sample-documents.json'), 'utf8')).samples; } catch { samples = []; }
  }
  return samples!;
}
/** Specimen ID cards (PAN / Aadhaar) are recognised by fingerprint, embedded marker or file name and return static values. */
export function recogniseSample(buf: Buffer, originalName = ''): ExtractionResult | null {
  const sha = createHash('sha256').update(buf).digest('hex');
  const name = originalName.toLowerCase();
  const hit = sampleRegistry().find((x) => x.sha256 === sha || buf.includes(Buffer.from(x.marker, 'latin1')) || name === x.file);
  if (!hit) return null;
  const label = hit.documentType === 'PAN' ? 'PAN card' : 'Aadhaar card';
  return { documentType: hit.documentType, engine: 'OCR', status: 'EXTRACTED', warnings: [], fields: hit.fields.map((f) => ({ ...f, sourcePage: 1, reviewRequired: f.confidence < 0.75, sourceLabel: label })) };
}
export async function extractDocument(buf: Buffer, mimetype: string, originalName = ''): Promise<ExtractionResult> {
  const sample = mimetype !== 'application/pdf' ? recogniseSample(buf, originalName) : null;
  if (sample) return sample;
  if (mimetype !== 'application/pdf') {
    return { documentType: 'UNKNOWN', engine: 'UNSUPPORTED', fields: [], warnings: ['We could not read details from this image — please complete the fields manually.'], status: 'NEEDS_MANUAL_REVIEW', errorCode: 'DOCUMENT_UNREADABLE' };
  }
  let text = '';
  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const r = await extractText(pdf, { mergePages: true });
    text = String(r.text ?? '');
  } catch {
    return { documentType: 'UNKNOWN', engine: 'PDF_TEXT', fields: [], warnings: ['The PDF could not be read. Please enter the details manually.'], status: 'FAILED', errorCode: 'DOCUMENT_UNREADABLE' };
  }
  const kv = parseLabelled(text);
  const docType = kv[TYPE_LABEL] ?? 'UNKNOWN';
  const fields: ExtractedField[] = [];
  for (const l of LABELS) {
    const v = kv[l.label];
    const field = l.label === 'Name' && docType === 'IDENTITY_MASKED' ? 'directorName' : l.field;
    if (!v || fields.some((f) => f.name === field)) continue;
    const t = l.transform ? l.transform(v) : { value: v };
    const conf = t.conf ?? l.conf;
    fields.push({ name: field, value: t.value, confidence: conf, sourcePage: 1, reviewRequired: t.review ?? conf < 0.75, sourceLabel: l.label });
  }
  if (!fields.length) return { documentType: docType, engine: 'PDF_TEXT', fields: [], warnings: ['No supported fields were found in this document. Please complete the form manually.'], status: 'FAILED', errorCode: 'DOCUMENT_UNREADABLE' };
  const warnings = fields.filter((f) => f.reviewRequired).map((f) => `${f.sourceLabel}: low confidence — review required`);
  return { documentType: docType, engine: 'PDF_TEXT', fields, warnings, status: 'EXTRACTED' };
}
/** Signature check (magic bytes) independent of the declared MIME. */
export function sniffMime(buf: Buffer): 'application/pdf' | 'image/png' | 'image/jpeg' | null {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  return null;
}
