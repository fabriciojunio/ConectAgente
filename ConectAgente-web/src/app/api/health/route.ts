import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { conferirEnv, chaveDeServicoVazou } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** Código do Postgres para permissão negada. */
const PERMISSAO_NEGADA = '42501';

/**
 * Health check endpoint for monitoring and deployment verification.
 * GET /api/health
 *
 * Returns:
 * - 200: Service is healthy, DB is reachable
 * - 503: Service is degraded (DB unreachable)
 */
export async function GET() {
  const start = Date.now();

  // Confere a configuracao antes de tocar o banco.
  //
  // Sem isto, um deploy com variavel faltando subia e caia no endereco de
  // exemplo: o painel respondia, as telas renderizavam e toda consulta
  // falhava em silencio, mostrando lista vazia em vez de erro. Quem usa
  // concluia que nao havia paciente cadastrado.
  //
  // A resposta nao diz QUAL variavel esta errada: o endpoint e publico, e a
  // lista de nomes de variavel ajuda quem esta sondando. O detalhe vai para
  // o log do servidor, que so quem opera le.
  const env = conferirEnv();
  if (!env.valido) {
    console.error('[health] configuracao invalida:', env.problemas);
    return NextResponse.json(
      {
        status: 'misconfigured',
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - start,
      },
      { status: 503 }
    );
  }

  // Isto nunca deveria ser verdade. Se for, a chave que ignora o RLS esta
  // dentro do pacote que vai para o navegador, e o sistema inteiro esta
  // exposto: melhor recusar a responder saudavel.
  if (chaveDeServicoVazou()) {
    console.error('[health] chave de servico com prefixo NEXT_PUBLIC_');
    return NextResponse.json(
      {
        status: 'misconfigured',
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - start,
      },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();

    // Quick DB connectivity check (lightweight query)
    const { error } = await supabase
      .from('agentes')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    const latencyMs = Date.now() - start;

    // Sem login, o banco recusa a leitura de qualquer tabela (42501). A
    // recusa vem do próprio Postgres, então prova que ele está de pé; dar
    // permissão ao visitante só para o health check abriria o que foi fechado.
    if (error && error.code !== PERMISSAO_NEGADA) {
      // Não expor error.message: o endpoint é público e detalhes do banco
      // (nomes de tabela, mensagens do Postgres) ajudariam um atacante.
      return NextResponse.json(
        {
          status: 'degraded',
          timestamp: new Date().toISOString(),
          database: 'unreachable',
          latencyMs,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      latencyMs,
    });
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - start,
      },
      { status: 503 }
    );
  }
}
