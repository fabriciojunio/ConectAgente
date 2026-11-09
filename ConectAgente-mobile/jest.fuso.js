/**
 * Fixa o fuso de toda a suíte no do Brasil, onde o aplicativo é usado.
 *
 * Data gravada sem hora, como `2026-10-13`, muda de dia quando é lida em UTC
 * e exibida no fuso de São Paulo. Num runner em UTC esse defeito passa
 * despercebido. Roda antes dos workers do Jest, que herdam a variável; trocar
 * `process.env.TZ` dentro de um teste não tem efeito no Linux da CI.
 */
module.exports = async () => {
  process.env.TZ = 'America/Sao_Paulo';
};
