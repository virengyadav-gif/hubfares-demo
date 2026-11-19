import { api } from '@/server/http';
import { seededDates } from '@/features/search/service';
export const GET = api({}, ({ db }) => seededDates(db));
