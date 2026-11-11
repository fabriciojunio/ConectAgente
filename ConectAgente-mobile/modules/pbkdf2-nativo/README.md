# pbkdf2-nativo

PBKDF2-HMAC-SHA256 calculado pelo Android, para o hash de senha do aplicativo.

## Por que existe

O hash de senha usa 100 mil iterações de PBKDF2. Em JavaScript puro, no Hermes, que não tem JIT, isso levava segundos em cada login, cadastro e troca de senha, e criar conta calcula duas vezes (senha e código de recuperação). Aqui o mesmo cálculo roda em código nativo, fora da thread da tela.

## Por que à mão sobre `Mac`, e não `SecretKeyFactory`

A `SecretKeyFactory` converte a senha em bytes do jeito do provedor de cada aparelho. Os hashes já gravados foram feitos pela `@noble/hashes`, com senha e sal em UTF-8. O `Pbkdf2.java` faz a RFC 8018 diretamente sobre o HMAC-SHA256 do sistema e converte em UTF-8, então o resultado é o mesmo, byte a byte.

## Como foi conferido

`Pbkdf2.java` compilado com o JDK 21 e comparado com a `@noble/hashes` em seis casos: os dois vetores da RFC 7914 (`passwd`/`salt`, 1 iteração, e `Password`/`NaCl`, 80 mil), senha com acento, senha vazia, senha com emoji e o caso real de 100 mil iterações com sal hexadecimal. Os seis saíram idênticos. No PC, 100 mil iterações levam cerca de 40 ms em Java.

Sem o módulo (testes no Jest e iOS), `src/utils/encryption.ts` calcula com a `@noble/hashes`.
