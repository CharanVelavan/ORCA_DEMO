# Showcase verification

This repository is a static learning and recorded-playback experience. It connects no AI model,
backend simulation or RAG query service. All captured network actions are emulated.

- Eleven bundles: ten mock-agent scenarios and a separately labeled past S1 fine-tuned-Qwen capture.
- `npm test`: 16 checks passed, covering ten-scenario coverage, original JSONL chains, bundle checksums,
  final summaries, source labels, control-event filtering and rejection of mutations before fetch.
- Tampered bytes and a changed chain with a recomputed file checksum both fail verification.
- TypeScript and Vite production build passed. The optional 3D chunk retains its existing size advisory.
- Chrome DevTools MCP checked scenario briefing → Console → Policy → Recovery → Audit with a shared
  final-state playhead. No `/api/` requests or browser console errors/warnings occurred in that journey.
- README screenshots and the 464 KB animated GIF show the actual read-only application.

Recording source commits, checksums and commander provenance are in `public/data/provenance.json`.
The historical model benchmark is not re-measured here. Hashes and the original chain establish
consistency with the bundled anchor; they are not an external signature or an independent attestation.

The public Vercel URL was also exercised through Chrome DevTools MCP: direct scenario-route access,
selection of the past S1 Qwen capture, Final state, and navigation through Policy, Recovery and Audit.
The browser verified the bundled original chain. No backend API calls or console errors/warnings
were observed. A 320 px scenario-page check had no document horizontal overflow.

Public site: https://orca-demo-blush.vercel.app

Vercel project `orca-demo` is linked to this repository's `main` branch. The initial Git-triggered
production build at source commit `509f7f8` completed successfully. The approved logo is byte-identical
to the supplied horizon PNG in both websites and both README asset folders. Main implementation
README/branding changes are published at `f4c0a48` on `ORCA` main and Pred.
