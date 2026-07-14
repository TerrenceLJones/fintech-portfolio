/**
 * Scoped styles, injected once at runtime so consumers need no CSS import or bundler CSS plugin.
 * Every color/size resolves to a `--beacon-*` custom property with a hardcoded fallback, so the
 * widget looks right out of the box and a host can theme it by setting `--beacon-*` (see the
 * provider's `theme` prop) without any dependency edge on the lib.
 */
export const STYLE_ELEMENT_ID = 'clearline-demo-beacon-styles';

export const CSS = `
.dbc-launcher {
  position: fixed; z-index: var(--beacon-z-index, 2147483000);
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 48px; min-width: 48px; padding: 0 16px; border-radius: 9999px; cursor: pointer;
  border: 1px solid var(--beacon-border, rgba(0,0,0,0.08));
  background: var(--beacon-accent, #4f46e5); color: var(--beacon-accent-contrast, #ffffff);
  font-family: var(--beacon-font, ui-sans-serif, system-ui, sans-serif);
  font-size: 14px; font-weight: 600; line-height: 1;
  box-shadow: 0 8px 28px rgba(0,0,0,0.22); transition: transform .12s ease, box-shadow .12s ease;
}
.dbc-launcher:hover { transform: translateY(-1px); box-shadow: 0 12px 34px rgba(0,0,0,0.28); }
.dbc-launcher:focus-visible { outline: 2px solid var(--beacon-focus, #ffffff); outline-offset: 2px; }
.dbc-launcher-icon { font-size: 18px; line-height: 1; }

.dbc-panel {
  position: fixed; z-index: var(--beacon-z-index, 2147483000);
  width: 380px; max-width: calc(100vw - 24px); max-height: 70vh;
  display: flex; flex-direction: column; overflow: hidden;
  border-radius: var(--beacon-radius, 16px);
  background: var(--beacon-surface, #ffffff); color: var(--beacon-text, #18181b);
  border: 1px solid var(--beacon-border, rgba(0,0,0,0.1));
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  font-family: var(--beacon-font, ui-sans-serif, system-ui, sans-serif);
  animation: dbc-in .14s ease;
}
@keyframes dbc-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (max-width: 480px) {
  .dbc-panel { width: 100vw; max-width: 100vw; left: 0 !important; right: 0 !important; bottom: 0 !important;
    max-height: 82vh; border-radius: 16px 16px 0 0; }
}

.dbc-header { display: flex; align-items: flex-start; gap: 8px; padding: 16px 16px 12px;
  border-bottom: 1px solid var(--beacon-border, rgba(0,0,0,0.08)); }
.dbc-header-titles { flex: 1; min-width: 0; }
.dbc-eyebrow { font-size: 10px; letter-spacing: .09em; text-transform: uppercase; font-weight: 700;
  color: var(--beacon-muted, #71717a); }
.dbc-title { font-size: 16px; font-weight: 700; margin: 2px 0 0; }
.dbc-summary { font-size: 12.5px; color: var(--beacon-text-2, #52525b); margin: 6px 0 0; line-height: 1.5; }
.dbc-close { flex: none; width: 28px; height: 28px; border-radius: 8px; border: 0; cursor: pointer;
  background: transparent; color: var(--beacon-text-2, #52525b); font-size: 16px; line-height: 1;
  display: inline-flex; align-items: center; justify-content: center; }
.dbc-close:hover { background: var(--beacon-inset, rgba(0,0,0,0.05)); color: var(--beacon-text, #18181b); }

.dbc-body { overflow-y: auto; padding: 6px 14px 14px; }
.dbc-section { padding: 12px 0; border-bottom: 1px solid var(--beacon-border, rgba(0,0,0,0.06)); }
.dbc-section:last-child { border-bottom: 0; }
.dbc-section-title { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
  color: var(--beacon-muted, #71717a); margin: 0 0 8px; }

.dbc-md code { font-family: var(--beacon-mono, ui-monospace, monospace);
  background: var(--beacon-inset, rgba(0,0,0,0.05)); padding: 1px 5px; border-radius: 5px; font-size: .92em; }
.dbc-md a, .dbc-link { color: var(--beacon-accent, #4f46e5); text-decoration: underline; cursor: pointer;
  background: none; border: 0; padding: 0; font: inherit; }
.dbc-text { font-size: 12.5px; line-height: 1.55; margin: 0; }

.dbc-row { display: flex; align-items: center; gap: 8px; padding: 7px 0;
  border-bottom: 1px dashed var(--beacon-border, rgba(0,0,0,0.07)); }
.dbc-row:last-child { border-bottom: 0; }
.dbc-row-label { color: var(--beacon-text-2, #52525b); font-size: 11.5px; min-width: 78px; }
.dbc-row-value { flex: 1; font-family: var(--beacon-mono, ui-monospace, monospace); font-size: 12px;
  word-break: break-all; }
.dbc-hint { display: block; color: var(--beacon-muted, #71717a); font-size: 11px; margin-top: 2px;
  font-family: var(--beacon-font, ui-sans-serif, system-ui, sans-serif); }

.dbc-table-wrap { overflow-x: auto; border: 1px solid var(--beacon-border, rgba(0,0,0,0.08)); border-radius: 8px; }
.dbc-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.dbc-table th { text-align: left; font-weight: 600; color: var(--beacon-muted, #71717a);
  padding: 6px 8px; background: var(--beacon-inset, rgba(0,0,0,0.03)); white-space: nowrap; }
.dbc-table td { padding: 6px 8px; border-top: 1px solid var(--beacon-border, rgba(0,0,0,0.06)); vertical-align: top; }
.dbc-table tr.dbc-clickable { cursor: pointer; }
.dbc-table tr.dbc-clickable:hover td { background: var(--beacon-inset, rgba(0,0,0,0.03)); }

.dbc-btn { align-self: flex-start; cursor: pointer; border-radius: 8px; padding: 6px 12px;
  font-size: 12px; font-weight: 600; font-family: inherit;
  border: 1px solid var(--beacon-border, rgba(0,0,0,0.14)); background: var(--beacon-surface, #fff);
  color: var(--beacon-text, #18181b); }
.dbc-btn:hover { background: var(--beacon-inset, rgba(0,0,0,0.04)); }
.dbc-btn:disabled { opacity: .6; cursor: default; }
.dbc-btn-accent { border-color: var(--beacon-accent, #4f46e5); color: var(--beacon-accent, #4f46e5);
  background: var(--beacon-accent-weak, rgba(79,70,229,0.08)); }
.dbc-btn-danger { border-color: var(--beacon-danger, #dc2626); color: var(--beacon-danger, #dc2626);
  background: var(--beacon-danger-weak, rgba(220,38,38,0.07)); }
.dbc-linkbtn { background: none; border: 0; padding: 0; cursor: pointer; font: inherit; font-size: 11px;
  font-weight: 600; color: var(--beacon-accent, #4f46e5); text-decoration: underline; white-space: nowrap; }

.dbc-actions { display: flex; flex-direction: column; gap: 10px; }
.dbc-action-row { display: flex; flex-direction: column; gap: 3px; }
.dbc-action-desc, .dbc-action-error { font-size: 11px; line-height: 1.4; }
.dbc-action-desc { color: var(--beacon-text-2, #52525b); }
.dbc-action-error { color: var(--beacon-danger, #dc2626); }
.dbc-confirm { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dbc-confirm-text { font-size: 11.5px; color: var(--beacon-text-2, #52525b); }

.dbc-toggle { display: flex; align-items: center; gap: 9px; }
.dbc-toggle-label { font-size: 12.5px; font-weight: 600; color: var(--beacon-text, #18181b); }
.dbc-switch { flex: none; position: relative; width: 34px; height: 20px; padding: 0; cursor: pointer;
  border-radius: 9999px; border: 1px solid var(--beacon-border, rgba(0,0,0,0.14));
  background: var(--beacon-inset-2, rgba(0,0,0,0.12)); transition: background .14s ease, border-color .14s ease; }
.dbc-switch:disabled { opacity: .55; cursor: default; }
.dbc-switch:focus-visible { outline: 2px solid var(--beacon-accent, #4f46e5); outline-offset: 2px; }
.dbc-switch.dbc-on { background: var(--beacon-accent, #4f46e5); border-color: var(--beacon-accent, #4f46e5); }
.dbc-switch-knob { position: absolute; top: 1px; left: 1px; width: 16px; height: 16px; border-radius: 9999px;
  background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.3); transition: transform .14s ease; }
.dbc-switch.dbc-on .dbc-switch-knob { transform: translateX(14px); }

.dbc-flow { border: 1px solid var(--beacon-border, rgba(0,0,0,0.08)); border-radius: 10px;
  margin-bottom: 8px; overflow: hidden; }
.dbc-flow:last-child { margin-bottom: 0; }
.dbc-flow-btn { width: 100%; display: flex; align-items: center; gap: 8px; cursor: pointer; text-align: left;
  background: var(--beacon-inset, rgba(0,0,0,0.03)); border: 0; padding: 9px 11px;
  color: var(--beacon-text, #18181b); font: inherit; font-size: 12.5px; font-weight: 600; }
.dbc-flow-btn:hover { background: var(--beacon-inset-2, rgba(0,0,0,0.06)); }
.dbc-flow-chev { margin-left: auto; color: var(--beacon-muted, #a1a1aa); transition: transform .15s ease; }
.dbc-flow-chev.dbc-open { transform: rotate(90deg); }
.dbc-flow-steps { list-style: none; margin: 0; padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
.dbc-flow-step { display: flex; gap: 8px; font-size: 12px; line-height: 1.45; }
.dbc-step-n { flex: none; width: 18px; height: 18px; border-radius: 9999px; font-size: 10px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--beacon-accent-weak, rgba(79,70,229,0.12)); color: var(--beacon-accent, #4f46e5); margin-top: 1px; }

.dbc-loading, .dbc-error, .dbc-empty { font-size: 12px; color: var(--beacon-text-2, #52525b); padding: 8px 0; }
.dbc-error { color: var(--beacon-danger, #dc2626); }
.dbc-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
`;
