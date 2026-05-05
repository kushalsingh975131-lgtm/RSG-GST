import { supabase } from "@/integrations/supabase/client";

export { supabase };

export const formatPid = (num: string | number): string => {
  const n = typeof num === 'string' ? num.replace(/\D/g, '') : String(num);
  if (!n || n === '0') return '0';
  return `RSG${n}`;
};

export const parsePidNumber = (pid: string): string => {
  if (pid === '0') return '0';
  return pid.replace(/^RSG/i, '');
};
