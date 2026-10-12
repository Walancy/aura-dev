import React from 'react';
import { Bell, BellRing, Siren } from 'lucide-react';
import { Panel, SmallButton, inputStyle } from '../../team/teamUi';
import { DEFAULT_PROJECT_SETTINGS, isQuietNow } from '../projectSettingsStore';
import { Field, Notice, NumberInput, Toggle, type SectionProps } from '../settingsUi';
import { logSystemActivity } from '../../../utils/brainService';

export const AlertsSection: React.FC<SectionProps> = ({ ctx, repoFullName, settings, update, showToast }) => {
  const { accentColor } = ctx;
  const al = settings.alerts;
  const nt = settings.notifications;
  const setAl = (patch: Partial<typeof al>) => {
    logSystemActivity('configuracoes_projeto', 'atualizar_regras_alertas', repoFullName, patch);
    update((s) => ({ ...s, alerts: { ...s.alerts, ...patch } }));
  };
  const setNt = (patch: Partial<typeof nt>) => {
    logSystemActivity('configuracoes_projeto', 'atualizar_notificacoes', repoFullName, patch);
    update((s) => ({ ...s, notifications: { ...s.notifications, ...patch } }));
  };
  const setEv = (patch: Partial<typeof nt.events>) => setNt({ events: { ...nt.events, ...patch } });

  const testNotification = async () => {
    if (nt.toast) showToast(`Teste de notificação — ${repoFullName}`);
    if (nt.system && 'Notification' in window) {
      const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      if (perm === 'granted') new Notification('Aura Dev', { body: `Teste de notificação — ${repoFullName}` });
      else showToast('Notificações do sistema bloqueadas. Libere em Ajustes do macOS → Notificações.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Panel
        ctx={ctx}
        icon={<Siren size={14} color={accentColor} />}
        title="Regras dos alertas (aba Time)"
        right={
          <SmallButton ctx={ctx} onClick={() => setAl({ ...DEFAULT_PROJECT_SETTINGS.alerts })}>
            Restaurar padrão
          </SmallButton>
        }
      >
        <Field ctx={ctx} label="PR sem nenhum review" hint="Alerta quando um PR aberto passa desse tempo sem review.">
          <NumberInput ctx={ctx} value={al.prNoReviewHours} min={1} max={720} suffix="horas" onChange={(v) => setAl({ prNoReviewHours: v })} />
        </Field>
        <Field ctx={ctx} label="Review segurado por um revisor" hint="Tempo que um review pedido pode esperar.">
          <NumberInput ctx={ctx} value={al.reviewWaitHours} min={1} max={720} suffix="horas" onChange={(v) => setAl({ reviewWaitHours: v })} />
        </Field>
        <Field ctx={ctx} label="Sobrecarga" hint="Pontuação de carga (issues + ½ em progresso + ½ PRs + reviews) a partir da qual alguém fica sobrecarregado. A capacidade da sprint (Fluxo de trabalho) também conta.">
          <NumberInput ctx={ctx} value={al.overloadScore} min={1} max={100} onChange={(v) => setAl({ overloadScore: v })} />
        </Field>
        <Field ctx={ctx} label="Membro parado com issues" hint="Dias sem atividade tendo issues atribuídas.">
          <NumberInput ctx={ctx} value={al.staleMemberDays} min={1} max={180} suffix="dias" onChange={(v) => setAl({ staleMemberDays: v })} />
        </Field>
        <Field ctx={ctx} label="Acesso inativo (auditoria)" hint="Dias sem atividade para sugerir reduzir o acesso.">
          <NumberInput ctx={ctx} value={al.inactiveAccessDays} min={7} max={365} suffix="dias" onChange={(v) => setAl({ inactiveAccessDays: v })} />
        </Field>
        <Field ctx={ctx} label="Máximo de admins" hint="Percentual de membros que pode ser admin antes do alerta (mínimo 2 pessoas).">
          <NumberInput ctx={ctx} value={al.maxAdminsPercent} min={5} max={100} suffix="%" onChange={(v) => setAl({ maxAdminsPercent: v })} />
        </Field>
      </Panel>

      <Panel
        ctx={ctx}
        icon={<Bell size={14} color={accentColor} />}
        title="Notificações"
        right={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <SmallButton ctx={ctx} onClick={testNotification}>
              <BellRing size={11} /> Testar
            </SmallButton>
            <Toggle ctx={ctx} checked={nt.enabled} onChange={(v) => setNt({ enabled: v })} />
          </div>
        }
      >
        <div style={{ fontSize: 11.5, color: ctx.theme.textSecondary }}>
          Com o Aura Dev aberto, verifica este repositório periodicamente e avisa sobre eventos novos que envolvem você.
        </div>
        {nt.enabled && isQuietNow(nt.quietStart, nt.quietEnd) && <Notice ctx={ctx}>Horário de silêncio ativo agora — as notificações ficam guardadas até o fim do período.</Notice>}
        <Field ctx={ctx} label="Issue atribuída a mim">
          <Toggle ctx={ctx} disabled={!nt.enabled} checked={nt.events.assignedToMe} onChange={(v) => setEv({ assignedToMe: v })} />
        </Field>
        <Field ctx={ctx} label="Review pedido a mim">
          <Toggle ctx={ctx} disabled={!nt.enabled} checked={nt.events.reviewRequested} onChange={(v) => setEv({ reviewRequested: v })} />
        </Field>
        <Field ctx={ctx} label="CI falhou" hint="Workflows do GitHub Actions que falharam em branches suas ou na padrão.">
          <Toggle ctx={ctx} disabled={!nt.enabled} checked={nt.events.ciFailed} onChange={(v) => setEv({ ciFailed: v })} />
        </Field>
        <Field ctx={ctx} label="Sprint/marco perto do prazo">
          {nt.events.milestoneDue && <NumberInput ctx={ctx} value={nt.milestoneDueDays} min={1} max={14} suffix="dias antes" onChange={(v) => setNt({ milestoneDueDays: v })} />}
          <Toggle ctx={ctx} disabled={!nt.enabled} checked={nt.events.milestoneDue} onChange={(v) => setEv({ milestoneDue: v })} />
        </Field>
        <Field ctx={ctx} label="Canais">
          <span style={{ fontSize: 11.5, color: ctx.theme.textSecondary }}>No app</span>
          <Toggle ctx={ctx} disabled={!nt.enabled} checked={nt.toast} onChange={(v) => setNt({ toast: v })} />
          <span style={{ fontSize: 11.5, color: ctx.theme.textSecondary, marginLeft: 8 }}>Sistema</span>
          <Toggle ctx={ctx} disabled={!nt.enabled} checked={nt.system} onChange={(v) => setNt({ system: v })} />
        </Field>
        <Field ctx={ctx} label="Horário de silêncio">
          <input type="time" disabled={!nt.enabled} value={nt.quietStart} onChange={(e) => setNt({ quietStart: e.target.value })} style={{ ...inputStyle(ctx), width: 100 }} />
          <span style={{ fontSize: 11.5, color: ctx.theme.textSecondary }}>até</span>
          <input type="time" disabled={!nt.enabled} value={nt.quietEnd} onChange={(e) => setNt({ quietEnd: e.target.value })} style={{ ...inputStyle(ctx), width: 100 }} />
        </Field>
        <Field ctx={ctx} label="Verificar a cada">
          <NumberInput ctx={ctx} value={nt.pollMinutes} min={2} max={60} suffix="min" onChange={(v) => setNt({ pollMinutes: v })} />
        </Field>
      </Panel>
    </div>
  );
};
