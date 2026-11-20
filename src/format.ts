export const eur = (n: number): string =>
  `${Math.round(n).toLocaleString("fr-FR")} €`;

export const pct = (n: number, digits = 0): string => `${(n * 100).toFixed(digits)} %`;
