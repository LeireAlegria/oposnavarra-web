import { createClient } from '@/lib/supabase/server';
import {
  demoAvailableSchema,
  publicCatalogSchema,
  type DemoAvailable,
  type PublicCatalog,
} from '@/lib/free-demo';
import { hasSupabaseConfig } from '@/lib/supabase/config';
export async function getDemoAvailable(): Promise<DemoAvailable | null> {
  if (!hasSupabaseConfig()) return null;
  try {
    const client = await createClient();
    const { data, error } = await client.rpc('demo_available');
    if (error || !data) return null;
    return demoAvailableSchema.parse(data);
  } catch {
    return null;
  }
}
export async function getPublicCatalog(): Promise<PublicCatalog | null> {
  if (!hasSupabaseConfig()) return null;
  try {
    const client = await createClient();
    const { data, error } = await client.rpc('demo_catalog');
    if (error) return null;
    return publicCatalogSchema.parse(data);
  } catch {
    return null;
  }
}
