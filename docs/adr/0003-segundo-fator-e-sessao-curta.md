# 3. Segundo fator no painel e sessão curta

Data: 2026-11-12
Situação: aceita

## Contexto

O painel mostra o dado de saúde de uma unidade inteira ou da cidade, e roda
em computador compartilhado de UBS. Senha vazada em outro site ou anotada no
monitor bastava para entrar, e o cookie de sessão durava 400 dias.

## Decisão

Todo acesso ao painel exige código TOTP de um app autenticador: o middleware
lê o nível `aal` do JWT assinado e só libera páginas com `aal2`. A sessão cai
com 30 minutos sem uso (cookie renovado a cada navegação) e com 12 horas desde
a senha, encerrada no servidor. Cookie `Secure` e `SameSite=Lax`, sem
"permanecer conectado". Ao entrar, ao sair e ao trocar de conta, o cache de
dado do navegador é apagado.

## Consequências

**O que se ganha.** Senha sozinha não abre o painel, e o computador
compartilhado não herda a sessão de ninguém (OWASP ASVS 4.0.3 V2 e V3, nível 2).

**O que se perde.** A coordenação digita o código a cada turno. O cookie não
pode ser `HttpOnly`, porque o cliente do Supabase lê o token no navegador; a
defesa contra roubo por script é a CSP com nonce. E o banco ainda aceita
sessão de um fator vinda do aplicativo, item aberto no modelo de ameaças.
