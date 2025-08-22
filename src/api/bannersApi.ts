import { supabase } from '../supaClient';

export interface Banner {
  id?: number;
  title: string;
  description?: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
  page_type?: string;
  jump_type?: string;
  jump_target?: string;
}

export async function fetchBanners(): Promise<Banner[]> {
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .order('sort_order', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchBannersByPageType(pageType: string): Promise<Banner[]> {
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .eq('page_type', pageType)
    .eq('is_active', true)
    .order('sort_order', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createBanner(banner: Omit<Banner, 'id'>): Promise<Banner> {
  const { data, error } = await supabase
    .from('banners')
    .insert([banner])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBanner(id: number, banner: Partial<Banner>): Promise<Banner> {
  const { data, error } = await supabase
    .from('banners')
    .update(banner)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBanner(id: number): Promise<boolean> {
  const { error } = await supabase
    .from('banners')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
} 