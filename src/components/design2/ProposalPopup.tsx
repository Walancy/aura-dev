import React, { useState } from 'react';
import FloatingPopup from './FloatingPopup';

interface Props {
  tokens: Record<string, any>;
  accentColor: string;
  frameNames: string[];
  onClose: () => void;
  onGenerate: (o: { client: string; company: string; notes: string }, status: (m: string) => void) => Promise<{ ok: boolean; message: string }>;
}

export default function ProposalPopup({ tokens, accentColor, frameNames, onClose, onGenerate }: Props) {
  const [client, setClient] = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const field: React.CSSProperties = { background: tokens.bgApp, border: `1px solid ${tokens.border}`, borderRadius: 6, color: tokens.textPrimary, fontSize: 12, padding: '7px 10px', outline: 'none', fontFamily: "'Poppins', sans-serif" };
  const stop = (e: React.KeyboardEvent) => e.stopPropagation();
  return (
    <FloatingPopup title="Proposta com IA" tokens={tokens} onClose={onClose} width={360} height="auto">
      <span style={{ fontSize: 11, color: tokens.textSecondary, lineHeight: 1.5 }}>
        A IA analisa {frameNames.length} tela(s) selecionada(s) ({frameNames.slice(0, 3).join(', ')}{frameNames.length > 3 ? '…' : ''}) e gera um PDF com as imagens e o texto da proposta.
      </span>
      <input style={field} placeholder="Nome do cliente (opcional)" value={client} onChange={(e) => setClient(e.target.value)} onKeyDown={stop} />
      <input style={field} placeholder="Sua empresa (opcional)" value={company} onChange={(e) => setCompany(e.target.value)} onKeyDown={stop} />
      <textarea style={{ ...field, height: 80, resize: 'vertical' }} placeholder="Contexto extra: segmento do cliente, objetivos, tom, diferenciais…" value={notes} onChange={(e) => setNotes(e.target.value)} onKeyDown={stop} />
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(false);
          const r = await onGenerate({ client, company, notes }, setStatus);
          setBusy(false);
          setError(!r.ok);
          setStatus(r.message);
        }}
        style={{ background: accentColor, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, padding: '8px 12px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}
      >
        {busy ? 'Gerando…' : 'Gerar proposta em PDF'}
      </button>
      {status && <span style={{ fontSize: 11, color: error ? '#f87171' : tokens.textSecondary }}>{status}</span>}
    </FloatingPopup>
  );
}
