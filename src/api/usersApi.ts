import { supabase } from '../supaClient';

export interface UserProfile {
  id: number;
  user_id: string;
  organization_id?: string;
  nickname: string;
  email?: string;
  status?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// 获取用户列表
export async function getUsersProfile(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('users_profile')
    .select('*')
    .order('nickname', { ascending: true });
  
  if (error) throw error;
  return data || [];
} 