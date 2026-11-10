import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { usePipeline } from '../../pipeline/pipelineStore';
import { describeEffect, IDLE, type Effect } from '../beats3d';
import type { Palette } from '../geo';
import type { FxCtx } from './common';
import { CommanderFx } from './CommanderFx';
import { CoordinateFx } from './CoordinateFx';
import { DetectFx } from './DetectFx';
import { GapFx } from './GapFx';
import { HealFx } from './HealFx';
import { RulesFx } from './RulesFx';
import { ThreatFx } from './ThreatFx';

const HOLD = 3.5; // seconds an effect stays fully visible after its beat
const FADE = 0.8;

const same = (a: Effect, b: Effect) => a.kind === b.kind && a.site === b.site && a.node === b.node && a.label === b.label && a.tone === b.tone;

/** Shared beat/packet -> effect descriptor. Only changes state (and so re-renders) when the descriptor really changes. */
export function useFxDescriptor(): Effect {
  const [fx, setFx] = useState<Effect>(IDLE);
  useEffect(() => {
    const run = () => {
      const s = usePipeline.getState();
      const e = describeEffect(s.beats[s.beats.length - 1], s.current, s.nodes, s.anomalySite);
      setFx((prev) => (same(prev, e) ? prev : e));
    };
    run();
    return usePipeline.subscribe(run);
  }, []);
  return fx;
}

/** Acts out the current flowchart moment in 3D. Everything animated here is driven by refs inside useFrame. */
export function EffectsLayer({ fx, palette, truth, reduced }: { fx: Effect; palette: Palette; truth: boolean; reduced: boolean }) {
  const nodes = usePipeline((s) => s.nodes);
  const packet = usePipeline((s) => s.current);
  const pending = usePipeline((s) => s.pending.length > 0);
  const beatId = usePipeline((s) => (s.beats.length ? s.beats[s.beats.length - 1].id : 0));
  const packetId = packet?.id ?? 0;

  const ctx = useRef<FxCtx>({
    palette, reduced, truth,
    age: { current: 0 }, pktAge: { current: 99 }, alpha: { current: 1 }, time: { current: 0 },
  }).current;
  ctx.palette = palette; ctx.reduced = reduced; ctx.truth = truth;
  const quiet = useRef(0);

  useEffect(() => { ctx.age.current = 0; }, [ctx, fx.kind, fx.site, fx.node, beatId]);
  useEffect(() => { quiet.current = 0; }, [beatId, packetId]);
  useEffect(() => { ctx.pktAge.current = 0; }, [ctx, packetId]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1); // a hidden tab must not fast-forward the choreography
    ctx.time.current += d; ctx.age.current += d; ctx.pktAge.current += d; quiet.current += d;
    ctx.alpha.current = quiet.current < HOLD ? 1 : Math.max(0, 1 - (quiet.current - HOLD) / FADE);
  });

  return (
    <group>
      {fx.kind === 'threat' && <ThreatFx fx={fx} ctx={ctx} />}
      {fx.kind === 'detect' && <DetectFx fx={fx} ctx={ctx} />}
      {fx.kind === 'coordinate' && <CoordinateFx fx={fx} ctx={ctx} nodes={nodes} packet={packet} />}
      {fx.kind === 'rules' && <RulesFx fx={fx} ctx={ctx} />}
      {(fx.kind === 'commander' || pending) && <CommanderFx ctx={ctx} nodes={nodes} pending={pending} />}
      {fx.kind === 'heal' && <HealFx fx={fx} ctx={ctx} nodes={nodes} />}
      <GapFx ctx={ctx} nodes={nodes} fx={fx} />
    </group>
  );
}
