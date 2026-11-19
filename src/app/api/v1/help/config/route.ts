import { api } from '@/server/http';
import { loadFixture } from '@/server/db/seed';
export const GET = api({ perm: 'AGENCY_SUPPORT' }, () => { const c = loadFixture('chatbot-scenarios.json'); return { mode: c.mode, languages: c.languages, messages: c.messages, menu: c.menu, controls: c.controls }; });
