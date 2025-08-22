export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  return phone.substring(0, 4) + '****' + phone.substring(phone.length - 3);
}
 
export function maskWechat(wechat: string): string {
  if (!wechat || wechat.length < 4) return wechat;
  return wechat.substring(0, 2) + '****' + wechat.substring(wechat.length - 2);
} 