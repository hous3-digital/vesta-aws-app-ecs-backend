/** Generates a CPF with valid check digits. Never a real person's number: the base is random. */
export function generateCpf(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const digit = (digits: number[]): number => {
    const sum = digits.reduce((acc, value, index) => acc + value * (digits.length + 1 - index), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const first = digit(base);
  const second = digit([...base, first]);
  return [...base, first, second].join("");
}
