// The one Supabase client the rider-area pages share. The URL and publishable key are public by design (every
// table is behind row-level security); astro.config.mjs passes them in from SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY.
import { createClient, type Session } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL as string;
const key = import.meta.env.PUBLIC_SUPABASE_KEY as string;

export const configured = Boolean(url && key);
export const sb = createClient(url || 'https://not-configured.invalid', key || 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'bas-auth' },
});

export type Role = 'rider' | 'coach' | 'admin';
export type Me = {
  session: Session;
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  instagram: string | null;
  bio: string | null;
  photoUrl: string | null;
  role: Role;
};

export async function getSession(): Promise<Session | null> {
  if (!configured) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

/** the signed-in person with their profile, or null */
export async function loadMe(): Promise<Me | null> {
  const session = await getSession();
  if (!session) return null;
  const { data: p } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  return {
    session,
    id: session.user.id,
    email: session.user.email ?? '',
    firstName: p?.first_name ?? null,
    lastName: p?.last_name ?? null,
    phone: p?.phone ?? null,
    instagram: p?.instagram ?? null,
    bio: p?.bio ?? null,
    photoUrl: p?.photo_url ?? null,
    role: (p?.role as Role) ?? 'rider',
  };
}

export const isStaff = (me: Me | null) => me?.role === 'coach' || me?.role === 'admin';
