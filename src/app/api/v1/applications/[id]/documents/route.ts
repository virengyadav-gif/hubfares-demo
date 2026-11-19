import { publicApi } from '@/server/http';
import { uploadDocument } from '@/features/onboarding/service';
import { AppError } from '@/shared/errors';
export const POST = publicApi({}, async ({ db, params, req }) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') throw new AppError('VALIDATION_ERROR', 'Attach a file');
  return uploadDocument(db, params.id, req.headers.get('x-application-token') ?? '', { name: file.name, type: file.type, buf: Buffer.from(await file.arrayBuffer()) });
});
