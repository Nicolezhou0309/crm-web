import { useState, useEffect } from 'react';
import { supabase } from '../../supaClient';

export class FrequencyController {
  private userId: number;
  constructor(userId: number) {
    this.userId = userId;
  }
  public getUserId() {
    return this.userId;
  }
  async checkFrequency(): Promise<{ allowed: boolean; message?: string; cooldown_until?: string }> {
    if (!this.userId || this.userId <= 0) {
      return { allowed: true };
    }
    try {
      const { data, error } = await supabase.rpc('check_operation_frequency', {
        p_user_id: this.userId,
        p_operation_type: 'update',
      });
      if (error) {
        console.error('[FREQ] RPC 调用失败:', error);
        return { allowed: true };
      }
      return { allowed: data.allowed, message: data.message, cooldown_until: data.cooldown_until };
    } catch (error) {
      console.error('[FREQ] 异常捕获:', error);
      return { allowed: true };
    }
  }
  async recordOperation(recordId?: string, oldValue?: string, newValue?: string): Promise<void> {
    if (!this.userId || this.userId <= 0) {
      return;
    }
    try {
      const { error } = await supabase.rpc('record_operation', {
        p_user_id: this.userId,
        p_operation_type: 'update',
        p_record_id: recordId,
        p_old_value: oldValue,
        p_new_value: newValue,
      });
      if (error) {
        console.error('[FREQ] recordOperation: RPC 调用失败，error:', error);
      }
    } catch (error) {
      console.error('[FREQ] recordOperation: 异常捕获，error:', error);
    }
  }
}

export function useFrequencyController() {
  const [frequencyController, setFrequencyController] = useState<FrequencyController | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id) {
        const { data: profileData, error: profileError } = await supabase
          .from('users_profile')
          .select('id')
          .eq('user_id', user.id)
          .single();
        if (!profileError && profileData && profileData.id) {
          setFrequencyController(new FrequencyController(profileData.id));
        } else {
          setFrequencyController(null);
        }
      } else {
        setFrequencyController(null);
      }
    };
    init();
  }, []);

  return frequencyController;
} 