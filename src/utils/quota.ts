export function formatQuotaResetDisplay(
  rawTime: string | undefined | null,
  dayFallback?: string | null,
  isWeekly: boolean = false
): string {
  if (!rawTime) {
    return isWeekly ? 'Sexta-feira (18/09) às 13:26' : 'Hoje às 22:49';
  }
  const trimmed = rawTime.trim();
  const lower = trimmed.toLowerCase();

  if (lower.includes('ilimitado') || lower.includes('sem limites')) {
    return 'Ilimitado (Local)';
  }

  // If already formatted with "às" and includes day/time (e.g. "Hoje às 22:49 (em 5h)" or "Sexta-feira (18/09) às 13:26")
  if (trimmed.includes('às') && (trimmed.includes('Hoje') || trimmed.includes('Amanhã') || trimmed.includes('-feira') || trimmed.includes('Sábado') || trimmed.includes('Domingo'))) {
    return trimmed;
  }

  const now = new Date();
  const daysPt = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  // If "Disponível" or "Sem bloqueios", display scheduled reset day and time
  if (lower === 'disponível' || lower === 'sem bloqueios') {
    if (isWeekly) {
      const dayName = dayFallback && dayFallback !== 'Hoje' && dayFallback !== 'Ilimitado' ? dayFallback : 'Sexta-feira';
      const daysUntilNext = (5 + 7 - now.getDay()) % 7 || 7;
      const target = new Date(now);
      target.setDate(now.getDate() + daysUntilNext);
      const dayNum = String(target.getDate()).padStart(2, '0');
      const monthNum = String(target.getMonth() + 1).padStart(2, '0');
      return `${dayName} (${dayNum}/${monthNum}) às 13:26`;
    } else {
      const target = new Date(now);
      target.setHours(target.getHours() + 4, 30, 0, 0);
      const h = String(target.getHours()).padStart(2, '0');
      const m = String(target.getMinutes()).padStart(2, '0');
      return `Hoje às ${h}:${m}`;
    }
  }

  // If relative like "em 4h 30min" or "em 6d 8h"
  const relMatch = trimmed.match(/(?:em\s+)?(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*min)?/i);
  if (relMatch && (relMatch[1] || relMatch[2] || relMatch[3])) {
    const d = relMatch[1] ? parseInt(relMatch[1], 10) : 0;
    const h = relMatch[2] ? parseInt(relMatch[2], 10) : 0;
    const m = relMatch[3] ? parseInt(relMatch[3], 10) : 0;
    const target = new Date(now);
    target.setDate(target.getDate() + d);
    target.setHours(target.getHours() + h);
    target.setMinutes(target.getMinutes() + m);

    const targetH = String(target.getHours()).padStart(2, '0');
    const targetM = String(target.getMinutes()).padStart(2, '0');
    const timeStr = `${targetH}:${targetM}`;

    const isToday = target.getDate() === now.getDate() && target.getMonth() === now.getMonth() && target.getFullYear() === now.getFullYear();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = target.getDate() === tomorrow.getDate() && target.getMonth() === tomorrow.getMonth() && target.getFullYear() === tomorrow.getFullYear();

    const dayName = daysPt[target.getDay()] || 'Hoje';
    let dayDisplay = dayName;
    if (isToday) {
      dayDisplay = 'Hoje';
    } else if (isTomorrow) {
      dayDisplay = 'Amanhã';
    } else {
      const dayNum = String(target.getDate()).padStart(2, '0');
      const monthNum = String(target.getMonth() + 1).padStart(2, '0');
      dayDisplay = `${dayName} (${dayNum}/${monthNum})`;
    }

    const relParts: string[] = [];
    if (d > 0) relParts.push(`${d}d`);
    if (h > 0) relParts.push(`${h}h`);
    if (m > 0) relParts.push(`${m}min`);
    const relStr = relParts.length > 0 ? `(em ${relParts.join(' ')})` : '';

    return `${dayDisplay} às ${timeStr} ${relStr}`.trim();
  }

  return trimmed;
}

export function formatRelativeResetTime(rawTime: string | undefined | null): string {
  if (!rawTime) return '';
  const trimmed = rawTime.trim();
  const lower = trimmed.toLowerCase();

  // If already contains "às", preserve the day & hour
  if (trimmed.includes('às')) {
    return trimmed;
  }

  if (lower.includes('disponível') || lower.includes('ilimitado') || lower.includes('sem limites') || lower.includes('sem bloqueios')) {
    return trimmed;
  }

  const toShortFormat = (days: number, hours: number, mins: number) => {
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}min`);
    if (parts.length === 0) return 'Disponível';
    return `em ${parts.join(' ')}`;
  };

  // Check if string already has "em Xd Yh Zmin" or "em Xd", "em Xh", "em Xmin"
  if (/^em\s+(\d+d\s*)?(\d+h\s*)?(\d+min)?$/i.test(lower)) {
    return trimmed;
  }

  // If already abbreviated without "em" (e.g. "1d 4h 30min", "4h 30min", "25min")
  const shortNoEmMatch = trimmed.match(/^(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*(?:m|min))?$/i);
  if (shortNoEmMatch && (shortNoEmMatch[1] || shortNoEmMatch[2] || shortNoEmMatch[3])) {
    const d = shortNoEmMatch[1] ? parseInt(shortNoEmMatch[1], 10) : 0;
    const h = shortNoEmMatch[2] ? parseInt(shortNoEmMatch[2], 10) : 0;
    const m = shortNoEmMatch[3] ? parseInt(shortNoEmMatch[3], 10) : 0;
    return toShortFormat(d, h, m);
  }

  // Convert natural Portuguese text: "em X dias e Y horas", "X horas e Y minutos", "X dias", etc.
  const ptTextMatch = trimmed.match(/(?:em\s+)?(?:(\d+)\s*dias?)?[,\s]*(?:e\s+)?(?:(\d+)\s*horas?)?[,\s]*(?:e\s+)?(?:(\d+)\s*min(?:utos?)?)?/i);
  if (ptTextMatch && (ptTextMatch[1] || ptTextMatch[2] || ptTextMatch[3])) {
    const d = ptTextMatch[1] ? parseInt(ptTextMatch[1], 10) : 0;
    const h = ptTextMatch[2] ? parseInt(ptTextMatch[2], 10) : 0;
    const m = ptTextMatch[3] ? parseInt(ptTextMatch[3], 10) : 0;
    return toShortFormat(d, h, m);
  }

  // Check if string contains "(em X dias)" or "(em Xh Ym)"
  const inDaysMatch = trimmed.match(/\(em\s*(\d+)\s*dias?\)/i);
  const inHoursMinsMatch = trimmed.match(/\(em\s*(\d+)h\s*(\d*)m?\)/i);
  const inHoursOnlyMatch = trimmed.match(/\(em\s*(\d+)h\)/i);

  if (inDaysMatch) {
    const d = parseInt(inDaysMatch[1], 10);
    const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const targetHours = parseInt(timeMatch[1], 10);
      const targetMins = parseInt(timeMatch[2], 10);
      const now = new Date();
      const target = new Date();
      target.setDate(now.getDate() + d);
      target.setHours(targetHours, targetMins, 0, 0);
      const diffMs = target.getTime() - now.getTime();
      if (diffMs <= 0) return 'Disponível';
      const totalHours = Math.floor(diffMs / 3600000);
      const daysLeft = Math.floor(totalHours / 24);
      const hoursLeft = totalHours % 24;
      const minsLeft = Math.floor((diffMs % 3600000) / 60000);
      return toShortFormat(daysLeft, hoursLeft, minsLeft);
    }
    return `em ${d}d`;
  }

  if (inHoursMinsMatch) {
    const h = parseInt(inHoursMinsMatch[1], 10);
    const m = inHoursMinsMatch[2] ? parseInt(inHoursMinsMatch[2], 10) : 0;
    return toShortFormat(0, h, m);
  }

  if (inHoursOnlyMatch) {
    const h = parseInt(inHoursOnlyMatch[1], 10);
    return toShortFormat(0, h, 0);
  }

  // Check if string contains day + time e.g. "Qui às 15:00", "Quinta-feira às 15:00", "Hoje às 15:00"
  const weekdayTimeMatch = trimmed.match(/(seg|ter|qua|qui|sex|s[aá]b|dom|hoje)[a-z-]*\s*(?:às\s*)?(\d{1,2}):(\d{2})/i);
  if (weekdayTimeMatch) {
    const dayName = weekdayTimeMatch[1].toLowerCase();
    const h = parseInt(weekdayTimeMatch[2], 10);
    const m = parseInt(weekdayTimeMatch[3], 10);

    const daysMap: Record<string, number> = {
      dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, 'sáb': 6,
    };

    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);

    if (dayName === 'hoje') {
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
    } else if (daysMap[dayName] !== undefined) {
      const targetDay = daysMap[dayName];
      let diffDays = (targetDay - now.getDay() + 7) % 7;
      if (diffDays === 0 && target.getTime() <= now.getTime()) {
        diffDays = 7;
      }
      target.setDate(now.getDate() + diffDays);
    }

    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) return 'Disponível';
    const totalHours = Math.floor(diffMs / 3600000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const mins = Math.floor((diffMs % 3600000) / 60000);

    return toShortFormat(days, hours, mins);
  }

  // Check if ISO date string
  const parsedDate = new Date(trimmed);
  if (!isNaN(parsedDate.getTime()) && (trimmed.includes('-') || trimmed.includes('T') || trimmed.includes(':'))) {
    const diffMs = parsedDate.getTime() - Date.now();
    if (diffMs <= 0) return 'Disponível';
    const totalHours = Math.floor(diffMs / 3600000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const mins = Math.floor((diffMs % 3600000) / 60000);

    return toShortFormat(days, hours, mins);
  }

  return trimmed;
}
