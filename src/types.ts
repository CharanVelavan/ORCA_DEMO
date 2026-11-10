export type EventKind = 'session'|'tick'|'inject'|'scheduled'|'model'|'alert'|'agent_task'|'agent_step'|'agent_final'|'agent_busy'|'msg'|'verdict'|'clock_obligation'|'approval'|'execute'|'heal'|'patch_stage'|'rollback'|'reattack'|'autonomy'|'kill'|'gap'|'kb_changed'|'rules_changed'|'phase'|'impact'|'clock_waiting'|'clock_resumed'|'summary'|'error';
export type LiveEvent = { seq:number; t:number; ts:string; kind:EventKind|string; audience?:'control'; [key:string]: unknown };
export type SiteState = { state:'ok'|'degraded'|'down'|'healing'; active_path?:string; gateway?:string; snr_db?:number; link_margin_db?:number; packet_loss?:number; battery_pct?:number; mains_power?:boolean; terminals_up?:number; traffic_load?:number; txn_success?:number; demand_mbps?:number; capacity_mbps?:number; delivered_mbps?:number };
export type Approval = { hash:string; playbook:string; owner:string; targets:string[]; reason:string; expires_at:string; clone_test?:string; status:string; mode?:string; [key:string]: unknown };
export type Agent = { role:string; busy?:boolean; queue?:number; lastAction?:string };
export type ServiceKey = '112'|'hospital'|'upi_atm'|'grid'|'general';
/** Instantaneous for one tick (not cumulative); pct is 0-100. */
export type ServiceDelivery = { demand_mbps:number; delivered_mbps:number; pct:number };
export type TickServices = Record<ServiceKey, ServiceDelivery>;
export type DeliveryUnits = { rate:'Mbps'; volume:'Mbit'; sample_duration_s:60 };
export type DeliveryCumulative = { demand_mbit:number; delivered_mbit:number; pct:number; min_pct:number; min_t:number };
export type DeliverySnapshot =
  | { available:false; reason:'not_simulated'; provenance:'packet_loss_floor_estimate' }
  | { available:false; reason:'awaiting_telemetry'; provenance:'emulated_simulator_allocation' }
  | {
      available:true; provenance:'emulated_simulator_allocation'; units:DeliveryUnits;
      now:{ t:number; network:ServiceDelivery; services:TickServices; sites:Record<string, ServiceDelivery & { services:TickServices }> };
      cumulative:{
        network:DeliveryCumulative; services:Record<ServiceKey, DeliveryCumulative>;
        sites:Record<string, DeliveryCumulative & { services:Record<ServiceKey, DeliveryCumulative> }>;
      };
    };
export type ConfigDiff = { target:string; device:string|null; before:string; after:string; unified:string; changed:boolean; missing_config?:boolean; warning?:string };
export type ExecuteDiffs = { diffs:ConfigDiff[]; diff:ConfigDiff|null; changed:boolean; revert_diff?:string; reason?:string; stage_pct?:number };
export type ClockTiming = { obligation_id?:string; obligation_seq?:number; policy_epoch?:number; regime:string; record_id:string; trigger:string|null; notified_before_start:boolean; started_at:string; due_at:string; notify_role:string; notified_at:string|null; time_to_notify_min:number|null; window_min:number|null; met:boolean|null };
/** null means not available yet (never zero or success). */
export type Timings = {
  incident_start_t:number|null; incident_start_ts:string|null; detected_at:string|null; time_to_detect_min:number|null;
  clocks:ClockTiming[]; time_to_notify_min:Record<string, number|null>; time_to_restore_min:number|null; restored_at:string|null;
  degraded:{ t:number; ts:string; pct:number; baseline_pct:number }|null;
  approvals:{ hash:string; playbook:string|null; auto:boolean; latency_s:number; latency_wall_s:number }[];
  approval_latency_s:number|null; approval_latency_wall_s:number|null;
  failed_attempts:number|null; failed_breakdown:{ rolled_back:number; refused:number }; rollback_ok:boolean|null;
};
export type ServiceSummary = {
  cumulative_demand_mbit_min:number; cumulative_delivered_mbit_min:number;
  cumulative_demand_mbit:number; cumulative_delivered_mbit:number; cumulative_pct:number;
  instant_demand_mbps:number; instant_delivered_mbps:number;
  instant_pct_now:number; instant_pct_min:number; instant_pct_min_t:number;
};
/** Emitted when a timing changes (final:false) and once at the end (final:true). */
export type SummaryEvent = LiveEvent & {
  kind:'summary'; final:boolean; scenario:string; rules:boolean; kb:string; timings:Timings;
  services:Partial<Record<ServiceKey, ServiceSummary>>;
  sites:Record<string, ServiceSummary & { services:Partial<Record<ServiceKey, ServiceSummary>> }>;
  network:Omit<Partial<ServiceSummary>, 'instant_pct_now'|'instant_pct_min'|'cumulative_pct'> & {
    instant_pct_now:number|null; instant_pct_min:number|null; cumulative_pct:number|null;
  };
  units:DeliveryUnits;
  impact_cumulative:Record<string, unknown>;
};

export type GapEvent = { kind:'gap'; gap_id:string; id:string; status:string; title:string|null; topic:string|null; jurisdiction:string; gap_kind:string|null; finding:string|null; evidence:unknown[]; affects:unknown[]; global_examples:unknown[]; recommendation:string|null; interim_action:string|null; records:string[]; rule:string|null; verdict:string|null; verified:boolean; verified_by:string|null; decision:{decision:'confirm'|'reject'; by:string; at:string}|null; source:'register'|'candidate' };
export type KbChangedEvent = { kind:'kb_changed'; kb:'india'|'eu'; previous:string; jurisdiction:string; previous_jurisdiction:string; kb_as_of:string };
export type ClockObligationEvent = { kind:'clock_obligation'; obligation_id?:string; policy_epoch?:number; regime:string; started_at:string; due_at:string; status:string; trigger:string; records:string[] };
export type RulesChangedEvent = { kind:'rules_changed'; rules:boolean; jurisdiction:string };
export type AuditChain = { ok:boolean|null; bad_seq:number|null; note:string };
export type ReplayAudit = { chain:AuditChain; entries:Record<string, unknown>[]; omitted_control:number };
export type ReplayResponse = { ok:boolean; source:'stream'|'audit'; events:LiveEvent[]; audit:ReplayAudit };
