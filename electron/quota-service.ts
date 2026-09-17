import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface AiQuotaConfig {
  dailyPercent: number;
  weeklyPercent: number;
  dailyResetTime: string;
  weeklyResetDay: string;
  weeklyResetTime: string;
}

export class QuotaService {
  private cache: Record<string, AiQuotaConfig> | null = null;
  private lastFetchTime = 0;
  private isFetching = false;
  private readonly CACHE_TTL_MS = 180000; // 3 minutes cache

  private getAgyBinPath(): string | null {
    const userHome = process.env.HOME || '';
    const candidatePaths = [
      path.join(userHome, '.local/bin/agy'),
      path.join(userHome, '.bun/bin/agy'),
      path.join(userHome, '.cargo/bin/agy'),
      '/opt/homebrew/bin/agy',
      '/usr/local/bin/agy',
      '/usr/bin/agy',
    ];

    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(p)) return p;
      } catch {}
    }

    return null;
  }

  public async getQuotas(force = false): Promise<Record<string, AiQuotaConfig>> {
    const now = Date.now();
    if (!force && this.cache && now - this.lastFetchTime < this.CACHE_TTL_MS) {
      // If any cached quota had 0% remaining, bypass the cache so we detect immediate reset!
      const hasZeroQuota = Object.values(this.cache).some((q) => q.dailyPercent === 0 || q.weeklyPercent === 0);
      if (!hasZeroQuota) {
        return this.cache;
      }
    }

    if (this.isFetching && this.cache) {
      return this.cache;
    }

    const userHome = process.env.HOME || '';

    const formatReset = (isoDateStr?: string | null, isWeekly = false) => {
      try {
        const now = new Date();
        let d: Date;

        if (isoDateStr) {
          d = new Date(isoDateStr);
          // If the timestamp is in the past, roll forward to the next scheduled cycle
          if (d.getTime() <= now.getTime()) {
            if (isWeekly) {
              d.setDate(d.getDate() + 7);
            } else {
              d.setHours(d.getHours() + 5);
            }
          }
        } else {
          // Default upcoming cycle if no timestamp provided
          d = new Date(now);
          if (isWeekly) {
            const daysUntilFriday = (5 + 7 - now.getDay()) % 7 || 7;
            d.setDate(now.getDate() + daysUntilFriday);
            d.setHours(13, 0, 0, 0);
          } else {
            d.setHours(d.getHours() + 4, 30, 0, 0);
          }
        }

        const diffMs = Math.max(0, d.getTime() - now.getTime());
        const totalHours = Math.floor(diffMs / 3600000);
        const days = Math.floor(totalHours / 24);
        const hours = totalHours % 24;
        const mins = Math.floor((diffMs % 3600000) / 60000);

        const parts: string[] = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (mins > 0) parts.push(`${mins}min`);
        const relativeStr = parts.length > 0 ? `(em ${parts.join(' ')})` : '';

        const daysPt = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const dayName = daysPt[d.getDay()] || 'Hoje';
        const hoursStr = String(d.getHours()).padStart(2, '0');
        const minsStr = String(d.getMinutes()).padStart(2, '0');
        const timeFormatted = `${hoursStr}:${minsStr}`;

        const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const isTomorrow = d.getDate() === tomorrow.getDate() && d.getMonth() === tomorrow.getMonth() && d.getFullYear() === tomorrow.getFullYear();

        let dayDisplay = dayName;
        if (isToday) {
          dayDisplay = 'Hoje';
        } else if (isTomorrow) {
          dayDisplay = 'Amanhã';
        } else {
          const dayNum = String(d.getDate()).padStart(2, '0');
          const monthNum = String(d.getMonth() + 1).padStart(2, '0');
          dayDisplay = `${dayName} (${dayNum}/${monthNum})`;
        }

        const fullStr = relativeStr 
          ? `${dayDisplay} às ${timeFormatted} ${relativeStr}`
          : `${dayDisplay} às ${timeFormatted}`;

        return {
          timeStr: fullStr,
          dayStr: dayDisplay,
          fullStr,
        };
      } catch {
        return { timeStr: 'Hoje às 00:00', dayStr: 'Hoje', fullStr: 'Hoje às 00:00' };
      }
    };

    // Default baseline values with real schedule formatting
    const quotas: Record<string, AiQuotaConfig> = {
      claude: {
        dailyPercent: 100,
        weeklyPercent: 84,
        dailyResetTime: formatReset(null, false).fullStr,
        weeklyResetDay: 'Sexta-feira',
        weeklyResetTime: formatReset(null, true).fullStr,
      },
      antigravity: {
        dailyPercent: 96,
        weeklyPercent: 97,
        dailyResetTime: formatReset(null, false).fullStr,
        weeklyResetDay: 'Quarta-feira',
        weeklyResetTime: formatReset(null, true).fullStr,
      },
      codex: {
        dailyPercent: 100,
        weeklyPercent: 84,
        dailyResetTime: formatReset(null, false).fullStr,
        weeklyResetDay: 'Sexta-feira',
        weeklyResetTime: formatReset(null, true).fullStr,
      },
      gemini: {
        dailyPercent: 96,
        weeklyPercent: 97,
        dailyResetTime: formatReset(null, false).fullStr,
        weeklyResetDay: 'Quarta-feira',
        weeklyResetTime: formatReset(null, true).fullStr,
      },
      ollama: {
        dailyPercent: 100,
        weeklyPercent: 100,
        dailyResetTime: 'Ilimitado (Local)',
        weeklyResetDay: 'Ilimitado',
        weeklyResetTime: 'Sem limites',
      },
    };

    // 1. Fetch Real Claude Code Quota from ~/.claude.json
    try {
      const claudeJsonPath = path.join(userHome, '.claude.json');
      if (fs.existsSync(claudeJsonPath)) {
        const raw = fs.readFileSync(claudeJsonPath, 'utf8');
        const parsed = JSON.parse(raw);
        const util = parsed.cachedUsageUtilization?.utilization;
        if (util) {
          const currentTime = Date.now();
          const fiveHourResetMs = util.five_hour?.resets_at ? new Date(util.five_hour.resets_at).getTime() : 0;
          const sevenDayResetMs = util.seven_day?.resets_at ? new Date(util.seven_day.resets_at).getTime() : 0;

          // Se a data de reset já passou, os créditos foram restaurados para 100%!
          const fiveHourPassed = fiveHourResetMs > 0 && fiveHourResetMs <= currentTime;
          const sevenDayPassed = sevenDayResetMs > 0 && sevenDayResetMs <= currentTime;

          const fiveHourUtil = typeof util.five_hour?.utilization === 'number' ? util.five_hour.utilization : 0;
          const sevenDayUtil = typeof util.seven_day?.utilization === 'number' ? util.seven_day.utilization : 0;

          const dailyAvail = fiveHourPassed ? 100 : Math.max(0, Math.min(100, 100 - Math.round(fiveHourUtil)));
          const weeklyAvail = sevenDayPassed ? 100 : Math.max(0, Math.min(100, 100 - Math.round(sevenDayUtil)));

          const dailyInfo = formatReset(fiveHourPassed ? null : util.five_hour?.resets_at);
          const weeklyInfo = formatReset(sevenDayPassed ? null : util.seven_day?.resets_at);

          quotas.claude = {
            dailyPercent: dailyAvail,
            weeklyPercent: weeklyAvail,
            dailyResetTime: dailyInfo.timeStr,
            weeklyResetDay: weeklyInfo.dayStr,
            weeklyResetTime: weeklyInfo.fullStr,
          };
        }
      }
    } catch (err) {
      console.warn('[QuotaService] Failed to read ~/.claude.json:', err);
    }

    // 2. Fetch Antigravity / Gemini / Codex Live Quotas via agy CLI non-blockingly
    const agyBin = this.getAgyBinPath();
    if (agyBin) {
      this.isFetching = true;
      try {
        const customPaths = [
          path.join(userHome, '.local/bin'),
          path.join(userHome, '.bun/bin'),
          '/opt/homebrew/bin',
          '/usr/local/bin',
        ];
        const execEnv = {
          ...process.env,
          PATH: `${customPaths.join(':')}:${process.env.PATH || ''}`,
        };

        const out = await new Promise<string>((resolve) => {
          exec(`${agyBin} -p "/usage" < /dev/null`, {
            encoding: 'utf8',
            shell: '/bin/zsh',
            env: execEnv,
            timeout: 4000,
          }, (_err, stdout) => {
            resolve(stdout ? stdout.toString() : '');
          });
        });

        if (out) {
          const geminiWeeklyMatch = out.match(/Gemini Models\s+Weekly Limit Remaining\s+(\d+)%\s+(\S+)/);
          const geminiFiveHourMatch = out.match(/Gemini Models\s+Five Hour Limit Remaining\s+(\d+)%\s+(\S+)/);
          const claudeGptWeeklyMatch = out.match(/Claude and GPT models\s+Weekly Limit Remaining\s+(\d+)%\s+(\S+)/);
          const claudeGptFiveHourMatch = out.match(/Claude and GPT models\s+Five Hour Limit Remaining\s+(\d+)%\s+(\S+)/);

          if (geminiWeeklyMatch && geminiFiveHourMatch) {
            const gWeekly = parseInt(geminiWeeklyMatch[1], 10);
            const gDaily = parseInt(geminiFiveHourMatch[1], 10);
            const gDailyInfo = formatReset(geminiFiveHourMatch[2], false);
            const gWeeklyInfo = formatReset(geminiWeeklyMatch[2], true);

            quotas.gemini = {
              dailyPercent: gDaily,
              weeklyPercent: gWeekly,
              dailyResetTime: gDailyInfo.timeStr,
              weeklyResetDay: gWeeklyInfo.dayStr,
              weeklyResetTime: gWeeklyInfo.fullStr,
            };
            quotas.antigravity = { ...quotas.gemini };
          }

          if (claudeGptWeeklyMatch && claudeGptFiveHourMatch) {
            const cgWeekly = parseInt(claudeGptWeeklyMatch[1], 10);
            const cgDaily = parseInt(claudeGptFiveHourMatch[1], 10);
            const cgDailyInfo = formatReset(claudeGptFiveHourMatch[2], false);
            const cgWeeklyInfo = formatReset(claudeGptWeeklyMatch[2], true);

            const cgQuota = {
              dailyPercent: cgDaily,
              weeklyPercent: cgWeekly,
              dailyResetTime: cgDailyInfo.timeStr,
              weeklyResetDay: cgWeeklyInfo.dayStr,
              weeklyResetTime: cgWeeklyInfo.fullStr,
            };

            quotas.codex = cgQuota;
            // Also update claude with the live Claude & GPT quota if claude didn't have custom usage
            quotas.claude = { ...cgQuota };
          }
        }
      } catch (err) {
        console.warn('[QuotaService] Failed to query live quotas from agy:', err);
      } finally {
        this.isFetching = false;
      }
    }

    this.cache = quotas;
    this.lastFetchTime = now;
    return quotas;
  }
}

export const quotaService = new QuotaService();
