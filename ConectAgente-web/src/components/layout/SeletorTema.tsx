'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTema, type ModoTema } from '@/hooks/useTema';

const OPCOES: Array<{ valor: ModoTema; rotulo: string; Icone: typeof Sun }> = [
  { valor: 'claro', rotulo: 'Claro', Icone: Sun },
  { valor: 'escuro', rotulo: 'Escuro', Icone: Moon },
  { valor: 'sistema', rotulo: 'Sistema', Icone: Monitor },
];

/**
 * Troca entre tema claro, escuro e o do sistema.
 *
 * São três botões em vez de um interruptor de dois estados porque "seguir o
 * sistema" é uma escolha diferente de "claro": quem deixa o computador em
 * modo escuro à noite espera que o painel acompanhe, e um interruptor não
 * consegue dizer isso.
 *
 * As cores aqui são fixas em branco translúcido, e não variáveis de tema,
 * porque este controle vive sobre a barra azul do cabeçalho, que tem a mesma
 * cor nos dois temas.
 */
export function SeletorTema() {
  const { modo, definirModo, montado } = useTema();

  return (
    <div
      role="radiogroup"
      aria-label="Tema da interface"
      className="flex items-center gap-0.5 rounded-lg bg-white/10 p-0.5"
    >
      {OPCOES.map(({ valor, rotulo, Icone }) => {
        // Antes de montar, nenhum aparece marcado: o valor real está no
        // cookie, e marcar o errado por um instante é pior que não marcar.
        const selecionado = montado && modo === valor;
        return (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={selecionado}
            aria-label={`Tema ${rotulo.toLowerCase()}`}
            title={rotulo}
            onClick={() => definirModo(valor)}
            className={`rounded-md p-1.5 transition-all ${
              selecionado
                ? 'bg-white/20 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <Icone size={16} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
