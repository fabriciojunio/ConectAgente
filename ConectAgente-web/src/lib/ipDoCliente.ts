/**
 * IP de quem fez a requisição, para o limite de tentativas.
 *
 * Quem ataca troca de IP (proxy, VPN, Tor, proxy rotativo) e, quando pode,
 * inventa o IP no cabeçalho `X-Forwarded-For`. O primeiro valor desse
 * cabeçalho é o que o CLIENTE diz ser; só é confiável se o proxy da borda o
 * reescreve. A Vercel reescreve, mas um proxy comum (nginx no padrão) só
 * acrescenta, e aí o atacante escolhe o IP que o limite vai contar.
 *
 * Por isso a ordem é: primeiro o cabeçalho que só a Vercel escreve, depois o
 * `x-real-ip` (que o proxy da borda define), e o `X-Forwarded-For` por último.
 * Mesmo assim o limite por IP é só a primeira camada: login e cadastro também
 * contam por CPF, que trocar de IP não muda.
 */
export function ipDoCliente(cabecalhos: { get(nome: string): string | null }): string {
  const daBorda = cabecalhos.get('x-vercel-forwarded-for') ?? cabecalhos.get('x-real-ip');
  const candidato = daBorda ?? cabecalhos.get('x-forwarded-for');
  const ip = candidato?.split(',')[0]?.trim();
  return ip && ip.length <= 45 ? ip : 'desconhecido';
}
