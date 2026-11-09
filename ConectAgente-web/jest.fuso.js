/**
 * Fixa o fuso de toda a suíte no do Brasil, onde o painel é usado.
 *
 * `data_visita` chega do banco como meia-noite em UTC. Num runner em UTC a
 * conversão para o fuso local não muda o dia, e o defeito de mostrar a visita
 * um dia antes passaria despercebido. Roda antes dos workers do Jest, que
 * herdam a variável.
 */
module.exports = async () => {
  process.env.TZ = 'America/Sao_Paulo';
};
