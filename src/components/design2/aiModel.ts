import { AI_PROVIDERS } from '../../constants/ai';

interface ActiveModelInfo { currentModel?: string }

/**
 * Modelo a passar para a CLI do provedor. O "modelo selecionado" global pode ser de OUTRO provedor
 * (ex.: "sonnet" com o Antigravity ativo, que então falha com "invalid model selection"):
 * usa o modelo ativo do provedor; senão o selecionado só se pertencer ao provedor; senão o padrão da CLI.
 */
export function resolveCliModel(
  provider: string | undefined,
  selectedModel: string | undefined,
  activeModels?: Record<string, ActiveModelInfo | undefined>,
  providerModels: string[] = AI_PROVIDERS.find((p) => p.id === provider)?.models || []
): string | undefined {
  if (!provider) return undefined;
  const current = activeModels?.[provider]?.currentModel;
  if (current) return current;
  if (!selectedModel) return undefined;
  const sel = selectedModel.toLowerCase();
  const belongs = providerModels.some((m) => {
    const l = m.toLowerCase();
    // só o Claude aceita apelidos ("sonnet" ~ "claude-sonnet-4-6"); nos demais o nome tem de ser exato
    // (senão "sonnet" casaria com o rótulo "Claude Sonnet 5.5 (High)" do Antigravity e a CLI recusaria)
    return provider === 'claude' ? l === sel || l.includes(sel) || sel.includes(l) : l === sel;
  });
  return belongs ? selectedModel : undefined;
}

/**
 * Variante "(Low)" do mesmo modelo, para tarefas que não pedem raciocínio profundo (ex.: descrever imagens):
 * "Gemini 3.8 Flash (High)" → "Gemini 3.8 Flash (Low)", mas só se esse modelo existir para o provedor.
 * Sem variante conhecida, devolve o modelo original (nunca inventa um nome inválido).
 */
export function lowEffortModel(
  provider: string | undefined,
  model: string | undefined,
  activeModels?: Record<string, { models?: Array<{ id: string; label: string }> } | undefined>,
  providerModels: string[] = AI_PROVIDERS.find((p) => p.id === provider)?.models || []
): string | undefined {
  if (!model || !provider) return model;
  const m = /^(.*)\s\((High|Medium|Alto|Médio|Media)\)\s*$/i.exec(model);
  if (!m) return model;
  const candidate = `${m[1]} (Low)`;
  const known = new Set<string>([...providerModels, ...(activeModels?.[provider]?.models || []).flatMap((x) => [x.label, x.id])].map((x) => x.toLowerCase()));
  return known.has(candidate.toLowerCase()) ? candidate : model;
}

/**
 * Modelo para ANALISAR imagens de referência (visão): nos testes o Claude Sonnet (Low) identificou muito melhor
 * espaços, painéis colados, bordas e raios que o Gemini Flash (Low), em ~35s. Usa-o se o provedor oferecer;
 * senão cai na variante "(Low)" do modelo atual.
 */
export function visionModel(
  provider: string | undefined,
  model: string | undefined,
  activeModels?: Record<string, { models?: Array<{ id: string; label: string }> } | undefined>,
  providerModels: string[] = AI_PROVIDERS.find((p) => p.id === provider)?.models || []
): string | undefined {
  if (!provider) return model;
  const labels = [...(activeModels?.[provider]?.models || []).map((m) => m.label), ...providerModels];
  const claudeLow = labels.find((l) => /claude[^()]*sonnet[^()]*\(\s*(low|baixo)\s*\)/i.test(l));
  return claudeLow || lowEffortModel(provider, model, activeModels, providerModels);
}
