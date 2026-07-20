import { describe, it, expect } from "vitest";
import { decidirAcaoLogon } from "../src/cli/scrapeOnLogon.js";

describe("decidirAcaoLogon", () => {
  it("coleta com sessao valida sem flags (corrige a issue #9)", () => {
    expect(decidirAcaoLogon(true, { forcar: false, dryRun: false })).toEqual({
      apenasVerificar: false,
      loginManual: false,
      coletar: true,
    });
  });

  it("pede login e coleta quando a sessao e invalida", () => {
    expect(decidirAcaoLogon(false, { forcar: false, dryRun: false })).toEqual({
      apenasVerificar: false,
      loginManual: true,
      coletar: true,
    });
  });

  it("forca login e coleta com --force mesmo com sessao valida", () => {
    expect(decidirAcaoLogon(true, { forcar: true, dryRun: false })).toEqual({
      apenasVerificar: false,
      loginManual: true,
      coletar: true,
    });
  });

  it("apenas verifica a sessao com --dry-run (sem coleta)", () => {
    expect(decidirAcaoLogon(true, { forcar: false, dryRun: true })).toEqual({
      apenasVerificar: true,
      loginManual: false,
      coletar: false,
    });
    expect(decidirAcaoLogon(false, { forcar: true, dryRun: true })).toEqual({
      apenasVerificar: true,
      loginManual: false,
      coletar: false,
    });
  });
});
