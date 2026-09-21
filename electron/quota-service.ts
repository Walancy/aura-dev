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
  private readonly CACHE_TTL_MS = 30000; // 30s cache for timely quota updates

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

  private getClaudeBinPath(): string | null {
    const userHome = process.env.HOME || '';
    const candidatePaths = [
      path.join(userHome, '.local/bin/claude'),
      path.join(userHome, '.bun/bin/claude'),
      path.join(userHome, '.cargo/bin/claude'),
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
      '/usr/bin/claude',
    ];

    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(p)) return p;
      } catch {}
    }

    return null;
  }

  // Parses Claude Code's own "/usage" reset phrasing, e.g. "Sep 18 at 6:30pm" or "Sep 21 at 1pm (America/Sao_Paulo)", into a Date.
  private parseClaudeResetClock(text: string, now: Date): Date | null {
    if (!text) return null;
    const cleaned = text.replace(/\s*\([^)]*\)/g, '').trim();
    const m = cleaned.match(/^([A-Za-z]{3})\w*\s+(\d{1,2})\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (!m) return null;
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monIdx = months.indexOf(m[1].toLowerCase());
    if (monIdx === -1) return null;
    let hour = parseInt(m[3], 10);
    const minute = m[4] ? parseInt(m[4], 10) : 0;
    const ampm = m[5].toLowerCase();
    if (ampm === 'pm' && hour !== 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    const day = parseInt(m[2], 10);
    let d = new Date(now.getFullYear(), monIdx, day, hour, minute, 0, 0);
    // A date that "already happened" more than a day ago must actually be next year's occurrence.
    if (d.getTime() < now.getTime() - 86400000) {
      d = new Date(now.getFullYear() + 1, monIdx, day, hour, minute, 0, 0);
    }
    return d;
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

          const dailyInfo = formatReset(fiveHourPassed ? null : util.five_hour?.resets_at, false);
          const weeklyInfo = formatReset(sevenDayPassed ? null : util.seven_day?.resets_at, true);

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

    // 1b. Fetch the REAL, live Claude Code subscription usage directly from the CLI
    // (`claude -p "/usage"`). This is the actual official Anthropic subscription quota —
    // ~/.claude.json's cached snapshot above is often stale or empty, so this live read
    // takes priority whenever the CLI is available and responds.
    const claudeBin = this.getClaudeBinPath();
    if (claudeBin) {
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
          exec(`${claudeBin} -p "/usage" < /dev/null`, {
            encoding: 'utf8',
            shell: '/bin/zsh',
            env: execEnv,
            timeout: 8000,
          }, (_err, stdout) => {
            resolve(stdout ? stdout.toString() : '');
          });
        });

        const sessionMatch = out.match(/Current session:\s*(\d+)%\s*used\s*·\s*resets\s*([^\n]+)/i);
        const weekMatch = out.match(/Current week[^:]*:\s*(\d+)%\s*used\s*·\s*resets\s*([^\n]+)/i);

        if (sessionMatch || weekMatch) {
          const nowDate = new Date();
          const dailyUsed = sessionMatch ? parseInt(sessionMatch[1], 10) : null;
          const weeklyUsed = weekMatch ? parseInt(weekMatch[1], 10) : null;
          const dailyResetDate = sessionMatch ? this.parseClaudeResetClock(sessionMatch[2], nowDate) : null;
          const weeklyResetDate = weekMatch ? this.parseClaudeResetClock(weekMatch[2], nowDate) : null;
          const dailyInfo = dailyResetDate ? formatReset(dailyResetDate.toISOString(), false) : null;
          const weeklyInfo = weeklyResetDate ? formatReset(weeklyResetDate.toISOString(), true) : null;

          quotas.claude = {
            dailyPercent: dailyUsed !== null ? Math.max(0, Math.min(100, 100 - dailyUsed)) : quotas.claude.dailyPercent,
            weeklyPercent: weeklyUsed !== null ? Math.max(0, Math.min(100, 100 - weeklyUsed)) : quotas.claude.weeklyPercent,
            dailyResetTime: dailyInfo ? dailyInfo.timeStr : quotas.claude.dailyResetTime,
            weeklyResetDay: dailyInfo ? dailyInfo.dayStr : quotas.claude.weeklyResetDay,
            weeklyResetTime: weeklyInfo ? weeklyInfo.fullStr : quotas.claude.weeklyResetTime,
          };
        }
      } catch (err) {
        console.warn('[QuotaService] Failed to query live quota from claude CLI:', err);
      }
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

            // Antigravity's own "Claude and GPT models" reading is its own proxy pool —
            // a different product from the official Claude Code subscription fetched
            // live above (1b), so it must only ever apply to `codex`, never `claude`.
            quotas.codex = cgQuota;
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
