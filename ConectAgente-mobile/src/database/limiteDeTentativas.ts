/**
 * Limite de tentativas de login e de recuperação de senha.
 *
 * Antes ficava só na memória: fechar e abrir o aplicativo zerava a contagem,
 * e quem quisesse adivinhar uma senha tinha cinco tentativas a cada
 * reabertura, sem espera nenhuma. Agora a contagem vai para o
 * armazenamento do aplicativo e sobrevive ao reinício.
 *
 * Por que o AsyncStorage, e não o SecureStore. A contagem não é segredo; o
 * que importa é que ela não suma. O AsyncStorage fica na área privada do
 * aplicativo, e o único jeito de apagá-lo sem acesso de root é limpar os dados
 * do aplicativo, o que apaga junto o banco e a chave dele: não sobra o que
 * atacar.
 *
 * A memória continua como cache, para `situacaoDasTentativas` responder sem
 * esperar o disco, e o disco é lido uma vez por processo.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MAX_TENTATIVAS = 5;
export const DURACAO_DO_BLOQUEIO_MS = 15 * 60 * 1000;
const CHAVE_NO_ARMAZENAMENTO = 'conectagente_tentativas_falhas';

interface Registro {
  falhas: number;
  /** Fim do bloqueio em milissegundos desde 1970; 0 quando não há bloqueio. */
  bloqueadoAte: number;
}

let cache: Map<string, Registro> | null = null;
let carregando: Promise<Map<string, Registro>> | null = null;

async function carregar(): Promise<Map<string, Registro>> {
  if (cache) return cache;
  if (!carregando) {
    carregando = (async () => {
      let lido: Record<string, Registro> = {};
      try {
        lido = JSON.parse((await AsyncStorage.getItem(CHAVE_NO_ARMAZENAMENTO)) ?? '{}');
      } catch {
        // Armazenamento ilegível começa vazio. Bloquear todo mundo por um
        // arquivo corrompido seria pior que perder a contagem.
      }
      cache = new Map(Object.entries(lido));
      return cache;
    })().finally(() => {
      carregando = null;
    });
  }
  return carregando;
}

/** Grava o mapa inteiro, sem os registros que já não valem nada. */
async function gravar(mapa: Map<string, Registro>): Promise<void> {
  const agora = Date.now();
  for (const [chave, r] of mapa) {
    if (r.bloqueadoAte !== 0 && r.bloqueadoAte <= agora) mapa.delete(chave);
  }
  try {
    await AsyncStorage.setItem(CHAVE_NO_ARMAZENAMENTO, JSON.stringify(Object.fromEntries(mapa)));
  } catch (erro) {
    console.error('Não foi possível gravar a contagem de tentativas:', erro);
  }
}

export async function estaBloqueado(chave: string): Promise<boolean> {
  const mapa = await carregar();
  const r = mapa.get(chave);
  if (!r || r.bloqueadoAte === 0) return false;
  if (r.bloqueadoAte > Date.now()) return true;
  mapa.delete(chave); // bloqueio venceu: recomeça a contagem
  await gravar(mapa);
  return false;
}

export async function registrarFalha(chave: string): Promise<void> {
  const mapa = await carregar();
  const r = mapa.get(chave) ?? { falhas: 0, bloqueadoAte: 0 };
  r.falhas += 1;
  if (r.falhas >= MAX_TENTATIVAS) r.bloqueadoAte = Date.now() + DURACAO_DO_BLOQUEIO_MS;
  mapa.set(chave, r);
  await gravar(mapa);
}

export async function limparFalhas(chave: string): Promise<void> {
  const mapa = await carregar();
  if (!mapa.delete(chave)) return;
  await gravar(mapa);
}

/** Tentativas restantes e fim do bloqueio, a partir do que já foi lido. */
export function situacaoDasTentativas(chave: string): {
  locked: boolean;
  remaining: number;
  unlocksAt?: number;
} {
  const r = cache?.get(chave);
  if (!r) return { locked: false, remaining: MAX_TENTATIVAS };
  if (r.bloqueadoAte > Date.now()) return { locked: true, remaining: 0, unlocksAt: r.bloqueadoAte };
  return { locked: false, remaining: Math.max(0, MAX_TENTATIVAS - r.falhas) };
}

/** Esquece tudo: no reinício do aparelho e nos testes. */
export async function apagarTentativas(): Promise<void> {
  cache = new Map();
  try {
    await AsyncStorage.removeItem(CHAVE_NO_ARMAZENAMENTO);
  } catch {
    // Sem armazenamento, a memória já está limpa.
  }
}

/**
 * Esquece só a memória, como se o aplicativo tivesse sido fechado e aberto.
 * Existe para o teste provar que a contagem sobrevive ao reinício.
 */
export function _esquecerMemoriaParaTeste(): void {
  cache = null;
}
