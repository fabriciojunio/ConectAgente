# 2. Offline primeiro, com banco cifrado no aparelho e fila de sincronização

Data: 2026-11-12
Situação: aceita

## Contexto

O agente trabalha na rua, em bairro com sinal fraco ou nenhum. Um sistema que
dependa de rede para registrar a visita não é usado: o agente volta ao papel.
E o celular pode ser perdido ou roubado com o dado de dezenas de famílias.

## Decisão

O aplicativo grava tudo num SQLite cifrado (SQLCipher, AES-256, chave
sorteada no primeiro uso e guardada no Keystore do Android) e põe cada
gravação numa fila. Quando há rede e sessão do servidor, a fila envia com
`upsert`; sem sessão, a sincronização para antes de tentar, para não gastar as
cinco tentativas por um motivo que não é do dado.

## Consequências

**O que se ganha.** O trabalho de campo não depende de sinal, e o aparelho
perdido não abre o banco.

**O que se perde.** O mesmo dado vive em dois lugares, e conflito vira regra
de negócio: o dono do registro no envio é a conta logada, e a falha de
sincronização precisa aparecer na tela (selo "Parada"), não num log.
