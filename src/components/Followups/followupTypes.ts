export interface Followup {
  id: string;
  leadid: string;
  created_at: string;
  source: string;
  leadtype: string;
  interviewsales_user_id?: number | null;
  interviewsales_user?: string;
  interviewsales_user_name?: string;
  showingsales_user_id?: number | null;
  showingsales_user?: string;
  showingsales_user_name?: string;
  followupstage: string;
  customerprofile: string;
  worklocation: string;
  userbudget: string;
  moveintime: string;
  userrating: string;
  majorcategory: string;
  followupresult: string;
  scheduletime: string;
  scheduledcommunity: string;
  phone: string;
  wechat: string;
  remark: string;
}

export interface Deal {
  id: string;
  leadid: string;
  contract_records?: string; // 关联到contract_records表的ID
  invalid?: boolean; // 软删除标记
  created_at?: string;
  isNew?: boolean;
  isEditing?: boolean;
} 