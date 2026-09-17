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

    const formatReset = (isoDateStr?: string | null) => {
      if (!isoDateStr) return { timeStr: 'Disponível', dayStr: 'Hoje', fullStr: 'Sem bloqueios' };
      try {
        const d = new Date(isoDateStr);
        const diffMs = d.getTime() - Date.now();
        if (diffMs <= 0) {
          return { timeStr: 'Disponível', dayStr: 'Hoje', fullStr: 'Disponível' };
        }
        const totalHours = Math.floor(diffMs / 3600000);
        const days = Math.floor(totalHours / 24);
        const hours = totalHours % 24;
        const mins = Math.floor((diffMs % 3600000) / 60000);

        const parts: string[] = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (mins > 0) parts.push(`${mins}min`);
        if (parts.length === 0) return { timeStr: 'Disponível', dayStr: 'Hoje', fullStr: 'Disponível' };
        const relativeStr = `em ${parts.join(' ')}`;

        const daysPt = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const dayStr = daysPt[d.getDay()] || 'Hoje';

        return {
          timeStr: relativeStr,
          dayStr,
          fullStr: relativeStr,
        };
      } catch {
        return { timeStr: 'Disponível', dayStr: 'Hoje', fullStr: 'Sem bloqueios' };
      }
    };

    // Default baseline values
    const quotas: Record<string, AiQuotaConfig> = {
      claude: {
        dailyPercent: 100,
        weeklyPercent: 100,
        dailyResetTime: 'Disponível',
        weeklyResetDay: 'Hoje',
        weeklyResetTime: 'Sem bloqueios',
      },
      antigravity: {
        dailyPercent: 96,
        weeklyPercent: 97,
        dailyResetTime: 'em 4h 30min',
        weeklyResetDay: 'Quarta-feira',
        weeklyResetTime: 'em 6d 8h',
      },
      codex: {
        dailyPercent: 100,
        weeklyPercent: 84,
        dailyResetTime: 'em 5h',
        weeklyResetDay: 'Sexta-feira',
        weeklyResetTime: 'em 1d 13h',
      },
      gemini: {
        dailyPercent: 96,
        weeklyPercent: 97,
        dailyResetTime: 'em 4h 30min',
        weeklyResetDay: 'Quarta-feira',
        weeklyResetTime: 'em 6d 8h',
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
            const gDailyInfo = formatReset(geminiFiveHourMatch[2]);
            const gWeeklyInfo = formatReset(geminiWeeklyMatch[2]);

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
            const cgDailyInfo = formatReset(claudeGptFiveHourMatch[2]);
            const cgWeeklyInfo = formatReset(claudeGptWeeklyMatch[2]);

            quotas.codex = {
              dailyPercent: cgDaily,
              weeklyPercent: cgWeekly,
              dailyResetTime: cgDailyInfo.timeStr,
              weeklyResetDay: cgWeeklyInfo.dayStr,
              weeklyResetTime: cgWeeklyInfo.fullStr,
            };
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
