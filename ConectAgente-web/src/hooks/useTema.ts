'use client';

import { useCallback, useEffect, useState } from 'react';

export type ModoTema = 'claro' | 'escuro' | 'sistema';

/** Nome do cookie. O layout do servidor lê o mesmo nome. */
export const COOKIE_TEMA = 'conectagente_tema';

export function ehModoValido(valor: unknown): valor is ModoTema {
  return valor === 'claro' || valor === 'escuro' || valor === 'sistema';
}

function sistemaPrefereEscuro(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function lerCookie(nome: string): string | null {
  if (typeof document === 'undefined') return null;
  const achado = document.cookie
    .split('; ')
    .find((p) => p.startsWith(`${nome}=`));
  return achado ? decodeURIComponent(achado.slice(nome.length + 1)) : null;
}

/**
 * Guarda a escolha num cookie, e não no localStorage.
 *
 * O motivo é de segurança, não de preferência. Para a página não piscar no
 * tema errado antes da hidratação, alguém precisa decidir a classe do <html>
 * já na primeira resposta. Com localStorage isso exigiria um script embutido
 * no <head>, e script embutido exige `'unsafe-inline'` na política de
 * segurança de conteúdo, que é justamente a brecha que torna um XSS
 * explorável. Com cookie, o servidor lê e decide, e a política continua
 * fechada.
 *
 * `SameSite=Lax` porque é preferência de interface, não sessão, e não há
 * nada a proteger contra requisição entre sites aqui. Sem `HttpOnly`,
 * porque o próprio cliente precisa reler e escrever.
 */
function gravarCookie(modo: ModoTema): void {
  if (typeof document === 'undefined') return;
  const umAno = 60 * 60 * 24 * 365;
  const seguro = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_TEMA}=${modo}; Path=/; Max-Age=${umAno}; SameSite=Lax${seguro}`;
}

function aplicar(modo: ModoTema): void {
  if (typeof document === 'undefined') return;
  const escuro = modo === 'escuro' || (modo === 'sistema' && sistemaPrefereEscuro());
  document.documentElement.classList.toggle('dark', escuro);
}

/**
 * Tema do painel, com as mesmas três opções do aplicativo.
 *
 * O Tailwind já estava em `darkMode: 'class'` desde o início, e não havia
 * uma única classe `dark:` escrita: a chave existia e não abria porta
 * nenhuma. Agora a paleta inteira é variável CSS, e o bloco `.dark` a
 * redefine, então uma classe no <html> muda o painel todo.
 */
export function useTema() {
  const [modo, definirModoEstado] = useState<ModoTema>('sistema');
  const [montado, setMontado] = useState(false);
  const [escuroAgora, setEscuroAgora] = useState(false);

  useEffect(() => {
    const salvo = lerCookie(COOKIE_TEMA);
    const inicial = ehModoValido(salvo) ? salvo : 'sistema';
    definirModoEstado(inicial);
    setEscuroAgora(
      inicial === 'escuro' || (inicial === 'sistema' && sistemaPrefereEscuro())
    );
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!montado) return;
    aplicar(modo);
    setEscuroAgora(
      modo === 'escuro' || (modo === 'sistema' && sistemaPrefereEscuro())
    );
  }, [modo, montado]);

  // Em 'sistema', acompanha a troca feita no sistema operacional sem recarregar.
  useEffect(() => {
    if (modo !== 'sistema' || typeof window === 'undefined') return;
    const consulta = window.matchMedia('(prefers-color-scheme: dark)');
    const aoMudar = () => {
      aplicar('sistema');
      setEscuroAgora(consulta.matches);
    };
    consulta.addEventListener('change', aoMudar);
    return () => consulta.removeEventListener('change', aoMudar);
  }, [modo]);

  const definirModo = useCallback((novo: ModoTema) => {
    definirModoEstado(novo);
    gravarCookie(novo);
  }, []);

  return {
    modo,
    definirModo,
    /** Verdadeiro quando a interface está escura agora, seja fixa ou pelo sistema. */
    estaEscuro: escuroAgora,
    /** Falso até o primeiro efeito rodar. Evita marcar a opção errada. */
    montado,
  };
}
