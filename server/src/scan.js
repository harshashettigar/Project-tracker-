// Virus scan hook (PRD §15.2: "files are virus-scanned before they are stored").
//
// DECISION (see docs/decisions.md): this app is standalone with no external
// integrations, so v1 does NOT call a third-party scanner. This is a PLUGGABLE
// hook: by default it is a no-op stub that passes the file through. A real
// scanner (e.g. a self-hosted ClamAV reachable over the network) can be wired in
// later behind SCAN_ENABLED without touching the upload endpoint.
//
// The upload endpoint calls scanFile() BEFORE persisting; a non-clean result
// must block the store.

// Returns { clean: boolean, detail?: string }.
export async function scanFile(buffer, meta) {
  if (process.env.SCAN_ENABLED === 'true') {
    // TODO(phase-9/infra): call the self-hosted scanner here and map its verdict.
    // Intentionally fail closed until a real scanner is wired, so enabling the
    // flag without an implementation never silently passes unscanned files.
    return { clean: false, detail: 'SCAN_ENABLED is set but no scanner is wired yet.' };
  }
  // Stub: no real scanning in v1. Accept the file as-is.
  void buffer;
  void meta;
  return { clean: true, detail: 'stub: scanning not performed (v1)' };
}
