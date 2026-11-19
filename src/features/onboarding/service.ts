/** Partner registration, document extraction review, mock KYC and approval (WF-01..03). */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { and, eq, desc, ne, inArray } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '@/server/db/schema';
import type { DB } from '@/server/db/client';
import { nextId, nextSeq, audit, domainEvent, notify, sha256, Tx } from '@/server/db/util';
import type { SessionCtx } from '@/server/auth/session';
import { hashPassword } from '@/server/auth/session';
import { AppError } from '@/shared/errors';
import { nowIso } from '@/shared/time';
import { extractDocument, sniffMime } from './extractor';
import { loadFixture } from '@/server/db/seed';

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const MOBILE_RE = /^\+?[0-9]{10,13}$/;
const person = z.object({ salutation: z.enum(['Mr', 'Ms', 'Mx']), firstName: z.string().trim().min(1).max(40), lastName: z.string().trim().min(1).max(40), email: z.string().trim().email(), mobile: z.string().trim().regex(MOBILE_RE, 'Enter a valid mobile number (e.g. +919000000000)') });
export const draftSchema = z.object({
  organization: z.object({ agencyName: z.string().trim().min(2).max(120), turnoverInr: z.coerce.number().int().min(0).max(1e12), entityType: z.enum(['PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED']), pan: z.string().trim().toUpperCase().regex(PAN_RE, 'PAN format: 5 letters, 4 digits, 1 letter (synthetic demo values only)'), gstin: z.string().trim().toUpperCase().max(15).optional().or(z.literal('')), registrationNumber: z.string().trim().max(30).optional().or(z.literal('')), website: z.string().trim().max(120).optional().or(z.literal('')) }),
  director: person, finance: person,
  communication: z.object({ email: z.string().trim().email(), mobile: z.string().trim().regex(MOBILE_RE), website: z.string().trim().max(120).optional().or(z.literal('')) }),
  address: z.object({ line1: z.string().trim().min(3).max(120), line2: z.string().trim().max(120).optional().or(z.literal('')), country: z.string().trim().min(2), state: z.string().trim().min(2), city: z.string().trim().min(2), postalCode: z.string().trim().regex(/^[0-9A-Z -]{4,10}$/i, 'Enter a valid PIN/postal code') }),
  acknowledged: z.literal(true, { errorMap: () => ({ message: 'Please acknowledge before submitting' }) }),
});
export const partialDraftSchema = z.object({}).passthrough();
export type Draft = z.infer<typeof draftSchema>;

const uploadsDir = () => path.resolve(process.cwd(), 'data', 'uploads');
function appByToken(tx: Tx, id: string, token: string) {
  const a = tx.select().from(s.registrationApplications).where(eq(s.registrationApplications.id, id)).get();
  if (!a || !a.accessTokenHash || a.accessTokenHash !== sha256(token)) throw new AppError('NOT_FOUND', 'Application not found or access token invalid');
  return a;
}
export function createApplication(db: DB, draft: Record<string, unknown>) {
  return db.transaction((tx) => {
    const n = nextSeq(tx, 'application', 100);
    const id = `APP${String(n).padStart(4, '0')}`;
    const token = randomBytes(24).toString('hex');
    const at = nowIso();
    tx.insert(s.registrationApplications).values({ id, reference: `HF-APP-${String(n).padStart(4, '0')}`, status: 'DRAFT', agencyDraftJson: JSON.stringify(draft ?? {}), accessTokenHash: sha256(token), createdAt: at, updatedAt: at, historyJson: JSON.stringify([{ at, status: 'DRAFT' }]) }).run();
    audit(tx, { userId: null, role: 'PUBLIC' }, 'APPLICATION_DRAFT_CREATED', 'application', id, null);
    return { id, reference: `HF-APP-${String(n).padStart(4, '0')}`, token, status: 'DRAFT' };
  });
}
export function saveDraft(db: DB, id: string, token: string, draft: Record<string, unknown>) {
  return db.transaction((tx) => {
    const a = appByToken(tx, id, token);
    if (!['DRAFT', 'MORE_INFO_REQUIRED'].includes(a.status)) throw new AppError('INVALID_STATE', `Application is ${a.status} and can no longer be edited`);
    tx.update(s.registrationApplications).set({ agencyDraftJson: JSON.stringify(draft), updatedAt: nowIso() }).where(eq(s.registrationApplications.id, id)).run();
    return { id, status: a.status, savedAt: nowIso() };
  });
}
export async function uploadDocument(db: DB, id: string, token: string, file: { name: string; type: string; buf: Buffer }) {
  const a = appByToken(db, id, token);
  if (!['DRAFT', 'MORE_INFO_REQUIRED'].includes(a.status)) throw new AppError('INVALID_STATE', 'Documents can only be added while the application is a draft');
  if (file.buf.length === 0) throw new AppError('VALIDATION_ERROR', 'Empty file');
  if (file.buf.length > 5 * 1024 * 1024) throw new AppError('VALIDATION_ERROR', 'File exceeds the 5 MB demo limit');
  const sniffed = sniffMime(file.buf);
  if (!sniffed || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type) || (sniffed !== file.type && !(sniffed === 'image/jpeg' && file.type === 'image/jpg'))) throw new AppError('VALIDATION_ERROR', 'Unsupported file. Allowed: PDF, PNG, JPG (signature checked)');
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);
  const docId = db.transaction((tx) => nextId(tx, 'doc'));
  const dir = path.join(uploadsDir(), id);
  fs.mkdirSync(dir, { recursive: true });
  const ext = sniffed === 'application/pdf' ? 'pdf' : sniffed === 'image/png' ? 'png' : 'jpg';
  fs.writeFileSync(path.join(dir, `${docId}.${ext}`), file.buf);
  const at = nowIso();
  db.insert(s.uploadedDocuments).values({ id: docId, applicationId: id, docType: 'PENDING_CLASSIFICATION', originalName: safeName, storageReference: `uploads/${id}/${docId}.${ext}`, mimetype: sniffed, sizeBytes: file.buf.length, extractionStatus: 'PROCESSING', createdAt: at }).run();
  const r = await extractDocument(file.buf, sniffed);
  db.transaction((tx) => {
    tx.update(s.uploadedDocuments).set({ docType: r.documentType, extractionStatus: r.status }).where(eq(s.uploadedDocuments.id, docId)).run();
    tx.insert(s.documentExtractions).values({ id: `ext_${docId}`, documentId: docId, documentType: r.documentType, fieldsJson: JSON.stringify(r.fields), warningsJson: JSON.stringify(r.warnings), engine: r.engine, createdAt: nowIso() }).run();
    audit(tx, { userId: null, role: 'PUBLIC' }, 'DOCUMENT_UPLOADED', 'application', id, null, { docId, extraction: r.status, engine: r.engine });
  });
  return { documentId: docId, originalName: safeName, mimetype: sniffed, sizeBytes: file.buf.length, ...r, verificationStatus: 'NOT_RUN', source: 'SYNTHETIC_DEMO' };
}
export function confirmExtraction(db: DB, id: string, token: string, docId: string, reviewed: Record<string, string>) {
  return db.transaction((tx) => {
    appByToken(tx, id, token);
    const d = tx.select().from(s.uploadedDocuments).where(and(eq(s.uploadedDocuments.id, docId), eq(s.uploadedDocuments.applicationId, id))).get();
    if (!d) throw new AppError('NOT_FOUND', 'Document not found');
    tx.update(s.documentExtractions).set({ reviewedFieldsJson: JSON.stringify(reviewed) }).where(eq(s.documentExtractions.documentId, docId)).run();
    return { documentId: docId, reviewedFields: reviewed };
  });
}
function duplicateCheck(tx: Tx, appId: string, d: Draft) {
  const name = d.organization.agencyName.trim().toLowerCase();
  if (tx.select().from(s.agencies).all().some((a) => a.displayName.toLowerCase() === name || a.legalName.toLowerCase() === name)) throw new AppError('DUPLICATE_RECORD', 'An agency with this name is already registered');
  const others = tx.select().from(s.registrationApplications).where(and(ne(s.registrationApplications.id, appId), inArray(s.registrationApplications.status, ['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED', 'APPROVED']))).all();
  if (others.some((o) => o.pan === d.organization.pan)) throw new AppError('DUPLICATE_RECORD', 'This PAN is already used by another registration (synthetic duplicate check)');
  if (tx.select().from(s.users).all().some((u) => u.email === d.director.email.toLowerCase())) throw new AppError('DUPLICATE_RECORD', 'Director email is already a registered user');
}
export function submitApplication(db: DB, id: string, token: string, draftInput: unknown) {
  const draft = draftSchema.parse(draftInput);
  return db.transaction((tx) => {
    const a = appByToken(tx, id, token);
    if (!['DRAFT', 'MORE_INFO_REQUIRED'].includes(a.status)) throw new AppError('INVALID_STATE', `Application already ${a.status}`);
    duplicateCheck(tx, id, draft);
    const at = nowIso();
    const hist = JSON.parse(a.historyJson); hist.push({ at, status: 'SUBMITTED' });
    tx.update(s.registrationApplications).set({ status: 'SUBMITTED', agencyDraftJson: JSON.stringify(draft), email: draft.communication.email, pan: draft.organization.pan, submitTime: at, updatedAt: at, historyJson: JSON.stringify(hist) }).where(eq(s.registrationApplications.id, id)).run();
    audit(tx, { userId: null, role: 'PUBLIC' }, 'APPLICATION_SUBMITTED', 'application', id, null);
    notify(tx, { audience: 'HUB', kind: 'APPLICATION_SUBMITTED', referenceId: id, title: `New agency application ${a.reference}: ${draft.organization.agencyName}` });
    return { id, reference: a.reference, status: 'SUBMITTED' };
  });
}
export function applicationStatus(db: Tx, id: string, token: string) {
  const a = appByToken(db, id, token);
  return { id: a.id, reference: a.reference, status: a.status, history: JSON.parse(a.historyJson), decisionNote: a.decisionNote, draft: JSON.parse(a.agencyDraftJson), documents: db.select().from(s.uploadedDocuments).where(eq(s.uploadedDocuments.applicationId, id)).all().map((d) => ({ id: d.id, originalName: d.originalName, docType: d.docType, extractionStatus: d.extractionStatus })) };
}
export function statusByReference(db: Tx, reference: string, email: string) {
  const a = db.select().from(s.registrationApplications).where(eq(s.registrationApplications.reference, reference.trim().toUpperCase())).get();
  if (!a || (a.email ?? '').toLowerCase() !== email.trim().toLowerCase()) throw new AppError('NOT_FOUND', 'No application found for that reference and email');
  return { id: a.id, reference: a.reference, status: a.status, history: JSON.parse(a.historyJson), decisionNote: a.decisionNote };
}

// ---------- Operations ----------
export function listApplications(db: Tx) {
  return db.select().from(s.registrationApplications).where(ne(s.registrationApplications.status, 'DRAFT')).orderBy(desc(s.registrationApplications.submitTime)).all().map((a) => {
    const d = JSON.parse(a.agencyDraftJson);
    return { id: a.id, reference: a.reference, status: a.status, agencyName: d.organization?.agencyName, city: d.address?.city, submitTime: a.submitTime, decisionTime: a.decisionTime, agencyId: a.agencyId };
  });
}
export function applicationDetail(db: Tx, id: string) {
  const a = db.select().from(s.registrationApplications).where(eq(s.registrationApplications.id, id)).get();
  if (!a) throw new AppError('NOT_FOUND', 'Application not found');
  const docs = db.select().from(s.uploadedDocuments).where(eq(s.uploadedDocuments.applicationId, id)).all();
  const exts = docs.length ? db.select().from(s.documentExtractions).where(inArray(s.documentExtractions.documentId, docs.map((d) => d.id))).all() : [];
  const checks = db.select().from(s.kycChecks).where(eq(s.kycChecks.applicationId, id)).orderBy(desc(s.kycChecks.checkedAt), desc(s.kycChecks.id)).all();
  const latest = (t: string) => checks.find((c) => c.checkType === t) ?? null;
  const draft = JSON.parse(a.agencyDraftJson);
  const maskedPan = draft.organization?.pan ? `${draft.organization.pan.slice(0, 4)}••${draft.organization.pan.slice(-3)}` : null;
  return {
    ...a, accessTokenHash: undefined, draft: { ...draft, organization: { ...draft.organization, pan: maskedPan } }, history: JSON.parse(a.historyJson),
    documents: docs.map((d) => ({ ...d, extraction: exts.find((e) => e.documentId === d.id) ? { ...exts.find((e) => e.documentId === d.id)!, fields: JSON.parse(exts.find((e) => e.documentId === d.id)!.fieldsJson), reviewed: JSON.parse(exts.find((e) => e.documentId === d.id)!.reviewedFieldsJson ?? 'null') } : null })),
    kyc: { PAN: latest('PAN'), IDENTITY: latest('IDENTITY'), BUSINESS: latest('BUSINESS') }, kycHistory: checks,
  };
}
export const kycSchema = z.object({ checkType: z.enum(['PAN', 'IDENTITY', 'BUSINESS']), scenario: z.enum(['kyc_ok', 'kyc_fail']).default('kyc_ok') });
/** Mock verification — separate from extraction. Deterministic: PAN must be synthetic DEMO-prefixed and well-formed; docs must exist. */
export function runMockKyc(db: DB, ctx: SessionCtx, id: string, input: z.infer<typeof kycSchema>) {
  return db.transaction((tx) => {
    const a = tx.select().from(s.registrationApplications).where(eq(s.registrationApplications.id, id)).get();
    if (!a) throw new AppError('NOT_FOUND', 'Application not found');
    if (!['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED'].includes(a.status)) throw new AppError('INVALID_STATE', `Application is ${a.status}`);
    const draft = JSON.parse(a.agencyDraftJson);
    const docs = tx.select().from(s.uploadedDocuments).where(eq(s.uploadedDocuments.applicationId, id)).all();
    let result: 'VERIFIED' | 'FAILED' | 'NOT_SUBMITTED' = 'VERIFIED'; let reason = 'Simulated check passed (demo verification — not a government lookup)';
    const needDoc = input.checkType === 'IDENTITY' ? 'IDENTITY_MASKED' : input.checkType === 'BUSINESS' ? 'BUSINESS_REGISTRATION' : null;
    if (needDoc && !docs.some((d) => d.docType === needDoc)) { result = 'NOT_SUBMITTED'; reason = `No ${needDoc.replace('_', ' ').toLowerCase()} document uploaded`; }
    else if (input.checkType === 'PAN' && !(PAN_RE.test(draft.organization?.pan ?? '') && String(draft.organization.pan).startsWith('DEMO'))) { result = 'FAILED'; reason = 'Simulated PAN check failed: identifier is not a recognised synthetic DEMO value'; }
    if (input.scenario === 'kyc_fail' && result === 'VERIFIED') { result = 'FAILED'; reason = 'Simulated failure scenario (kyc_fail) — name mismatch on demo record'; }
    const at = nowIso();
    tx.insert(s.kycChecks).values({ id: nextId(tx, 'kyc'), applicationId: id, documentId: needDoc ? docs.find((d) => d.docType === needDoc)?.id ?? null : null, checkType: input.checkType, mockResult: result, reason, source: 'SIMULATED', checkedAt: at, actorId: ctx.userId }).run();
    if (a.status === 'SUBMITTED') {
      const hist = JSON.parse(a.historyJson); hist.push({ at, status: 'UNDER_REVIEW', by: ctx.name });
      tx.update(s.registrationApplications).set({ status: 'UNDER_REVIEW', reviewerId: ctx.userId, updatedAt: at, historyJson: JSON.stringify(hist) }).where(eq(s.registrationApplications.id, id)).run();
    }
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'KYC_MOCK_CHECK', 'application', id, null, { checkType: input.checkType, result });
    return { checkType: input.checkType, result, reason, source: 'SIMULATED', label: 'Demo verification' };
  });
}
export const decisionSchema = z.object({ decision: z.enum(['APPROVE', 'REJECT', 'MORE_INFO']), note: z.string().trim().max(300).optional() });
export function decideApplication(db: DB, ctx: SessionCtx, id: string, input: z.infer<typeof decisionSchema>) {
  return db.transaction((tx) => {
    const a = tx.select().from(s.registrationApplications).where(eq(s.registrationApplications.id, id)).get();
    if (!a) throw new AppError('NOT_FOUND', 'Application not found');
    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(a.status)) throw new AppError('INVALID_STATE', `Application already ${a.status} — decisions are recorded once`);
    const at = nowIso();
    const hist = JSON.parse(a.historyJson);
    if (input.decision !== 'APPROVE') {
      if (!input.note) throw new AppError('VALIDATION_ERROR', 'A reason is required');
      const st = input.decision === 'REJECT' ? 'REJECTED' : 'MORE_INFO_REQUIRED';
      hist.push({ at, status: st, by: ctx.name, note: input.note });
      tx.update(s.registrationApplications).set({ status: st, decisionNote: input.note, reviewerId: ctx.userId, decisionTime: at, updatedAt: at, historyJson: JSON.stringify(hist) }).where(eq(s.registrationApplications.id, id)).run();
      audit(tx, { userId: ctx.userId, role: ctx.role }, `APPLICATION_${st}`, 'application', id, null, { note: input.note });
      return { id, status: st };
    }
    const pan = tx.select().from(s.kycChecks).where(and(eq(s.kycChecks.applicationId, id), eq(s.kycChecks.checkType, 'PAN'))).orderBy(desc(s.kycChecks.checkedAt), desc(s.kycChecks.id)).get();
    if (pan?.mockResult !== 'VERIFIED') throw new AppError('INVALID_STATE', 'Approval requires a completed mock PAN verification (green tick)');
    const d = draftSchema.parse(JSON.parse(a.agencyDraftJson));
    const slug = d.organization.agencyName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24);
    const agencyId = `agency_${slug}`;
    if (tx.select().from(s.agencies).where(eq(s.agencies.id, agencyId)).get()) throw new AppError('DUPLICATE_RECORD', 'Agency already exists');
    tx.insert(s.agencies).values({ id: agencyId, legalName: `${d.organization.agencyName} (${d.organization.entityType.replace('_', ' ').toLowerCase()})`, displayName: d.organization.agencyName, status: 'ACTIVE', country: 'IN', city: d.address.city, state: d.address.state, panMasked: `${d.organization.pan.slice(0, 4)}••${d.organization.pan.slice(-3)}`, gstin: d.organization.gstin || null, contactEmail: d.communication.email, applicationId: id, registeredAt: a.submitTime ?? at, activatedAt: at }).run();
    const userId = `user_${slug}_admin`;
    tx.insert(s.users).values({ id: userId, agencyId, name: `${d.director.firstName} ${d.director.lastName}`, email: d.director.email.toLowerCase(), mobile: d.director.mobile, role: 'AGENCY_ADMIN', status: 'ACTIVE', passwordHash: hashPassword(userId, DEMO_INITIAL_PASSWORD), createdAt: at }).run();
    const defaults = loadFixture('policies.json').defaultsForNewAgency;
    tx.insert(s.agencyPolicies).values({ id: `credit_${slug}_v1`, agencyId, type: 'CREDIT', version: 1, effectiveFrom: at, enabled: true, configJson: JSON.stringify(defaults.CREDIT), createdBy: ctx.userId, createdAt: at }).run();
    tx.insert(s.agencyPolicies).values({ id: `refund_${slug}_v1`, agencyId, type: 'REFUND', version: 1, effectiveFrom: at, enabled: true, configJson: JSON.stringify(defaults.REFUND), createdBy: ctx.userId, createdAt: at }).run();
    hist.push({ at, status: 'APPROVED', by: ctx.name, note: input.note ?? 'Approved after demo verification' }, { at, status: 'ACTIVE', note: `Agency ${agencyId} activated; initial Agency Admin ${d.director.email}` });
    tx.update(s.registrationApplications).set({ status: 'APPROVED', agencyId, decisionNote: input.note ?? null, reviewerId: ctx.userId, decisionTime: at, updatedAt: at, historyJson: JSON.stringify(hist) }).where(eq(s.registrationApplications.id, id)).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'APPLICATION_APPROVED', 'application', id, agencyId, { agencyId, adminUserId: userId });
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'USER_ACTIVATED', 'user', userId, agencyId, { role: 'AGENCY_ADMIN' });
    domainEvent(tx, 'agency.activated', 'agency', agencyId, agencyId);
    notify(tx, { audience: 'AGENCY', agencyId, kind: 'AGENCY_ACTIVATED', referenceId: agencyId, title: `Welcome to Hubfares — ${d.organization.agencyName} is active (demo)` });
    return { id, status: 'APPROVED', agencyId, adminUserId: userId, adminEmail: d.director.email.toLowerCase() };
  });
}
/** Initial Agency Admin password for agencies approved during the demo (operator-documented, synthetic). */
export const DEMO_INITIAL_PASSWORD = 'Hubfares@Demo2026';
