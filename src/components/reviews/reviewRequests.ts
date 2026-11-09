import { ghSettings } from '../settings/settingsUi';

export interface ReviewRequest {
  number: number;
  title: string;
  url: string;
  repo: string; // owner/repo
  author?: string;
  authorAvatar?: string;
  draft: boolean;
  updatedAt: string;
}

const DISMISSED_KEY = 'devflow_review_dismissed_v1';

export const reviewRequestId = (r: Pick<ReviewRequest, 'repo' | 'number'>) => `review:${r.repo}#${r.number}`;

export function loadDismissedReviews(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
  } catch {
    return [];
  }
}

// PRs que já geraram aviso: um PR só avisa uma vez, mesmo que continue pendente
const SEEN_KEY = 'devflow_review_seen_v1';

// Retorna os ainda não avisados e marca todos como vistos. Na primeira execução só registra (não avisa o backlog antigo).
export function takeNewReviews(requests: ReviewRequest[]): ReviewRequest[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const seen = new Set<string>(raw ? JSON.parse(raw) : []);
    const fresh = requests.filter((r) => !seen.has(reviewRequestId(r)));
    fresh.forEach((r) => seen.add(reviewRequestId(r)));
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-500)));
    return raw === null ? [] : fresh;
  } catch {
    return [];
  }
}

export function dismissReview(id: string) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...new Set([...loadDismissedReviews(), id])].slice(-300)));
  } catch {}
}

// PRs abertos em que o usuário logado foi pedido como revisor (ignora os que ele mesmo abriu)
export async function fetchReviewRequests(myLogin?: string): Promise<ReviewRequest[]> {
  const list = await ghSettings<ReviewRequest[]>('reviewRequests', {});
  return list.filter((r) => !myLogin || r.author?.toLowerCase() !== myLogin.toLowerCase());
}
