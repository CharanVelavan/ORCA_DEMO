// IST formatting helpers. All visible times in ORCA are IST (Asia/Kolkata).
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const fmtShort = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });

export const ist = (ts?: string | null, seconds = true): string => {
  if (!ts) return '--:--';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '--:--';
  return (seconds ? fmt : fmtShort).format(d);
};

export const nowIst = () => fmt.format(new Date());

/** Minutes:seconds left between a sim timestamp and a due timestamp. */
export const leftOf = (now: string, due: string): string => {
  const ms = new Date(due).getTime() - new Date(now).getTime();
  if (!Number.isFinite(ms)) return '--:--';
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000), s = Math.floor((ms % 60_000) / 1000);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(s).padStart(2, '0')}`;
};
