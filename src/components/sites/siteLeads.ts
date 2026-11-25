// Captação: a IA procura sites e landing pages com visual antigo e WhatsApp de contato; o app lista e abre o WhatsApp.
export interface SiteLead {
  id: string;
  name: string;
  url: string;
  /** só dígitos, com DDI (55 para o Brasil) */
  whatsapp: string;
  niche?: string;
  city?: string;
  problems: string[];
  foundAt: number;
}

export const buildLeadsPrompt = (o: { niche: string; region: string; count: number; known: string[]; angle?: string }): string => `Você ajuda uma agência de sites a achar clientes. Use a ferramenta de busca na web para encontrar ENDEREÇOS de sites próprios de negócios reais${o.niche ? ` do nicho "${o.niche}"` : ' de nichos variados (clínicas, advogados, oficinas, restaurantes, academias, imobiliárias, escolas, lojas locais...)'}${o.region ? ` na região "${o.region}"` : ' no Brasil'}${o.angle ? `. Seu recorte: ${o.angle}` : ''}.

SÓ BUSQUE, NÃO ABRA PÁGINAS: o app confere cada endereço sozinho (WhatsApp, nicho e visual antigo). Seu trabalho é achar muitos candidatos depressa.
- Faça várias buscas variadas, 3 a 4 na MESMA rodada (por exemplo "[nicho] [cidade] whatsapp", "[nicho] [cidade] orçamento", "[nicho] [bairro]", "[nicho] [cidade] contato").
- Prefira sites pequenos e simples de negócios locais; sites com cara de antigos, feitos em construtores baratos, com domínio próprio (.com.br) ou subdomínio de construtor.
- Ignore redes sociais, marketplaces, diretórios e listas ("melhores...", Doctoralia, GuiaMais, Jusbrasil, Facebook, Instagram) e grandes empresas.
- Já listados, não repita: ${o.known.length ? o.known.slice(0, 80).join(', ') : 'nenhum ainda'}.
- Pare ao reunir ${o.count} endereços novos ou quando as buscas deixarem de trazer sites novos.

RESPOSTA
A cada resultado que parecer um site próprio de negócio, escreva na hora uma linha sozinha, assim:
URL: https://www.exemplo.com.br
Sem texto antes ou depois das linhas, sem explicações. Ao terminar, escreva só FIM.`;

/** Endereços indicados pela IA nas linhas `URL: https://...` (só linhas completas). */
export function parseCandidateUrls(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/^\s*URL:\s*(https?:\/\/[^\s<>"')]+)\s*$/gm)) out.push(m[1]);
  return out;
}

const KEY = 'aura_sites_leads_v1';
export const readLeads = (): SiteLead[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
export const writeLeads = (l: SiteLead[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(l.slice(0, 300)));
  } catch {}
};
export const whatsappUrl = (l: SiteLead) => `https://wa.me/${l.whatsapp}`;
export const hostOf = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
};
