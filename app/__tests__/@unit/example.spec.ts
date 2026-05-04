// Este é um teste de exemplo, devem deletar esse arquivo e escrever testes correspondentes.

import { describe, expect, it } from "@jest/globals";

describe("Exemplos de testes unitários", () => {
  it("deve somar corretamente dois números", () => {
    const sum = (a: number, b: number): number => a + b;

    expect(sum(2, 3)).toBe(5);
    expect(sum(-1, 1)).toBe(0);
  });
});
