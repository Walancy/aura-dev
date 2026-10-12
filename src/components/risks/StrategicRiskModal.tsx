import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Check } from 'lucide-react';
import type { StrategicRisk, StrategicRiskCategory, StrategicRiskStatus } from './types';

interface StrategicRiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (risk: Omit<StrategicRisk, 'id' | 'createdAtIso' | 'updatedAtIso'>, editingId?: string) => void;
  editingRisk?: StrategicRisk | null;
  theme: any;
  isEffectiveDark: boolean;
  accentColor: string;
  accentContrastText: string;
}

const CATEGORIES: StrategicRiskCategory[] = ['Técnico', 'Negócio', 'Infraestrutura', 'Pessoas', 'Terceiros'];
const STATUSES: StrategicRiskStatus[] = ['Identificado', 'Em Monitoramento', 'Mitigado', 'Ocorrido'];

export const StrategicRiskModal: React.FC<StrategicRiskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingRisk,
  theme,
  isEffectiveDark,
  accentColor,
  accentContrastText,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<StrategicRiskCategory>('Técnico');
  const [impact, setImpact] = useState<'low' | 'medium' | 'high'>('medium');
  const [probability, setProbability] = useState<'low' | 'medium' | 'high'>('medium');
  const [mitigationPlan, setMitigationPlan] = useState('');
  const [contingencyPlan, setContingencyPlan] = useState('');
  const [status, setStatus] = useState<StrategicRiskStatus>('Identificado');
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingRisk) {
      setTitle(editingRisk.title);
      setCategory(editingRisk.category);
      setImpact(editingRisk.impact);
      setProbability(editingRisk.probability);
      setMitigationPlan(editingRisk.mitigationPlan);
      setContingencyPlan(editingRisk.contingencyPlan);
      setStatus(editingRisk.status);
    } else {
      setTitle('');
      setCategory('Técnico');
      setImpact('medium');
      setProbability('medium');
      setMitigationPlan('');
      setContingencyPlan('');
      setStatus('Identificado');
    }
    setError('');
  }, [editingRisk, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('O título do risco é obrigatório.');
      return;
    }

    onSave(
      {
        title: title.trim(),
        category,
        impact,
        probability,
        mitigationPlan: mitigationPlan.trim(),
        contingencyPlan: contingencyPlan.trim(),
        status,
      },
      editingRisk?.id
    );
    onClose();
  };

  const bgModal = theme.modalBg || (isEffectiveDark ? '#181818' : '#ffffff');
  const inputBg = theme.modalInputBg || (isEffectiveDark ? '#222222' : '#f1f5f9');
  const textPrimary = theme.textPrimary || (isEffectiveDark ? '#ffffff' : '#111111');
  const textSecondary = theme.textSecondary || (isEffectiveDark ? '#a8a8a8' : '#666666');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: isEffectiveDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          background: bgModal,
          borderRadius: 10,
          border: 'none',
          boxShadow: isEffectiveDark
            ? '0 20px 50px rgba(0, 0, 0, 0.85)'
            : '0 20px 50px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px 10px',
            borderBottom: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 7,
                background: isEffectiveDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
              }}
            >
              <ShieldAlert size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 400, color: textPrimary }}>
                {editingRisk ? 'Editar Risco Estratégico' : 'Cadastrar Novo Risco'}
              </div>
              <div style={{ fontSize: 11.5, color: textSecondary, fontWeight: 400 }}>
                Identifique riscos de negócio, infraestrutura ou técnicos externos
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: textSecondary,
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                fontSize: 11.5,
                fontWeight: 400,
                padding: '8px 12px',
                borderRadius: 6,
                border: 'none',
              }}
            >
              {error}
            </div>
          )}

          {/* Título do Risco */}
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 400, color: textPrimary, marginBottom: 5 }}>
              Título do Risco *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Atraso na homologação da API externa de pagamentos"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 6,
                background: inputBg,
                border: 'none',
                color: textPrimary,
                fontSize: 12.5,
                fontWeight: 400,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Categoria e Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 400, color: textPrimary, marginBottom: 5 }}>
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as StrategicRiskCategory)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: inputBg,
                  border: 'none',
                  color: textPrimary,
                  fontSize: 12,
                  fontWeight: 400,
                  outline: 'none',
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 400, color: textPrimary, marginBottom: 5 }}>
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StrategicRiskStatus)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: inputBg,
                  border: 'none',
                  color: textPrimary,
                  fontSize: 12,
                  fontWeight: 400,
                  outline: 'none',
                }}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Impacto e Probabilidade */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 400, color: textPrimary, marginBottom: 5 }}>
                Impacto no Projeto
              </label>
              <div style={{ display: 'flex', gap: 5 }}>
                {(['low', 'medium', 'high'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setImpact(lvl)}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      borderRadius: 5,
                      fontSize: 11,
                      fontWeight: 400,
                      border: 'none',
                      background: impact === lvl ? (isEffectiveDark ? 'rgba(255, 106, 0, 0.2)' : 'rgba(255, 106, 0, 0.12)') : inputBg,
                      color: impact === lvl ? accentColor : textSecondary,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {lvl === 'low' ? 'Baixo' : lvl === 'medium' ? 'Médio' : 'Alto'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 400, color: textPrimary, marginBottom: 5 }}>
                Probabilidade
              </label>
              <div style={{ display: 'flex', gap: 5 }}>
                {(['low', 'medium', 'high'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setProbability(lvl)}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      borderRadius: 5,
                      fontSize: 11,
                      fontWeight: 400,
                      border: 'none',
                      background: probability === lvl ? (isEffectiveDark ? 'rgba(255, 106, 0, 0.2)' : 'rgba(255, 106, 0, 0.12)') : inputBg,
                      color: probability === lvl ? accentColor : textSecondary,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {lvl === 'low' ? 'Baixa' : lvl === 'medium' ? 'Média' : 'Alta'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Plano de Mitigação */}
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 400, color: textPrimary, marginBottom: 5 }}>
              Plano de Mitigação (Prevenção)
            </label>
            <textarea
              rows={2}
              value={mitigationPlan}
              onChange={(e) => setMitigationPlan(e.target.value)}
              placeholder="O que faremos para evitar que este risco ocorra?"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                background: inputBg,
                border: 'none',
                color: textPrimary,
                fontSize: 12,
                fontWeight: 400,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Plano de Contingência */}
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 400, color: textPrimary, marginBottom: 5 }}>
              Plano de Contingência (Se o risco ocorrer)
            </label>
            <textarea
              rows={2}
              value={contingencyPlan}
              onChange={(e) => setContingencyPlan(e.target.value)}
              placeholder="Qual será o plano de emergência caso o risco se concretize?"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                background: inputBg,
                border: 'none',
                color: textPrimary,
                fontSize: 12,
                fontWeight: 400,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Rodapé de Ações */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 400,
                background: isEffectiveDark ? '#242424' : '#f1f5f9',
                border: 'none',
                color: textSecondary,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 16px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 400,
                background: accentColor,
                color: accentContrastText,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Check size={14} />
              <span>{editingRisk ? 'Salvar Alterações' : 'Cadastrar Risco'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
