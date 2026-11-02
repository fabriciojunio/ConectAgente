# Análise do APK com MobSF

*[Read this in English](en/mobsf.md)*

O MobSF 4.5.3 roda na CI contra o APK de cada release (workflow `mobsf.yml`), num contêiner
descartável: o APK não sai para serviço de fora. Este documento é a triagem da versão 1.1.0, com o
que foi corrigido, o que é da biblioteca e o que fica aceito, e do que mudou na 1.2.0.

## Antes e depois

| | APK 1.1.0 antes | APK 1.1.0 publicado | APK 1.2.0 publicado |
|---|---|---|---|
| Nota do MobSF | 55/100 | 56/100 | 56/100 |
| Achados altos | 1 | 1 | 1 |
| Avisos | 13 | 11 | 12 |
| Permissões perigosas | 6 | 3 | 3 |

A nota do MobSF quase não se mexe com correção de manifesto: ela pesa sobretudo o `minSdk`. O que
importa está nas linhas de baixo.

## Corrigido

| Achado | Correção | Prova |
|---|---|---|
| `android:allowBackup=true` | o banco com dado de saúde saía pelo backup do Google e por `adb backup`; `allowBackup: false` no `app.json` | manifesto do APK publicado |
| `CropImageActivity` exportada sem proteção | qualquer app do aparelho abria a tela de recorte da biblioteca; `exported="false"` pelo plugin `plugins/endurecer-manifesto.js` | manifesto do APK e `endurecerManifesto.test.ts` |
| `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, `WRITE_EXTERNAL_STORAGE` | vinham das dependências e nenhuma função usa; `blockedPermissions` no `app.json` | permissões do APK publicado |

As três permissões perigosas que ficaram são usadas: notificação de lembrete, câmera e galeria para
a foto de perfil.

## O que mudou na 1.2.0

Os dois achados novos vêm do certificado fixado, e nenhum pede correção.

| Achado | Severidade | Leitura |
|---|---|---|
| `supabase.co` confia nos certificados do sistema | aviso | regra genérica do MobSF para qualquer `<certificates src="system"/>`. O `pin-set` vale por cima: até a expiração, certificado de outra CA do sistema que não passe pela WE1 ou pela GTS Root R4 é recusado. O trecho só repete o padrão do Android 7 em diante e deixa de fora CA instalada pelo usuário |
| O pin expira em 01/05/2027 | informativo | decisão de projeto: passada a data o Android deixa de exigir o pin em vez de travar o agente sem saída remota. Renovar antes, com o procedimento do cabeçalho de `plugins/fixar-certificado.js` |

Execução: [MobSF na release v1.2.0](https://github.com/fabriciojunio/ConectAgente/actions/runs/41493336633),
relatório completo no artefato `mobsf-v1.2.0`.

## Da biblioteca, sem efeito no ConectAgente

| Achado | Onde está | Por que não se aplica |
|---|---|---|
| Receptores e serviço "protegidos por permissão" | Firebase, WorkManager, ProfileInstaller | protegidos por permissão de sistema (`BIND_JOB_SERVICE`, `DUMP`, `c2dm.SEND`) que app comum não obtém |
| Informação sensível no código | Coil, Glide | padrão de nome em código de cache de imagem; nenhum valor de senha ou chave apareceu na lista de segredos |
| Segredos no código | tabelas e símbolos do Hermes e do Reanimated | os 808 itens foram filtrados por padrão de credencial (`sb_`, `eyJ`, `AIza`, secret, password, key): só símbolos de código nativo, nenhuma chave, senha ou token |
| SQL cru | AsyncStorage | consulta fixa da própria biblioteca. No banco do app todo valor vai como parâmetro; o único texto montado são nomes de tabela e coluna de uma lista fixa no código (`lgpdRepository.levantarVencidos`) |
| MD5 | módulos de arquivo e asset do Expo | usado como identificador de cache, não como proteção |
| Arquivo temporário e armazenamento externo | Coil e a biblioteca de recorte | arquivo temporário da imagem de perfil, no cache do app |
| Divulgação de endereço IP | módulo de rede do Expo | o app não usa o endereço IP para nada |
| Log de informação | Glide e outras | log das bibliotecas, sem dado do app; o log do próprio app não leva documento nem dado clínico (revisão de código) |

## Aceito, com prazo de decisão

**`minSdk=24`: o app instala em Android 7.0.** É o único achado alto. Android 7 não recebe correção
de segurança desde 2019, e aparelho antigo pode estar sem a cifra de disco. Desde a 1.2.0 o banco
local é cifrado pelo próprio aplicativo com SQLCipher, então a cifra de disco deixou de ser a única
barreira; o que sobra é o sistema sem correção (ver [seguranca.md](seguranca.md)).

Subir o `minSdk` resolve, mas deixa de fora o agente que tem celular antigo, e isso é decisão da
secretaria, não técnica. A recomendação é o `minSdk 29` (Android 10, em que a cifra passou a ser
obrigatória em aparelho novo), depois de levantar os aparelhos da equipe. Até lá o risco fica
registrado aqui e revisto a cada release.

## Como reproduzir

Na aba Actions do repositório, workflow "Análise do APK (MobSF)", botão "Run workflow" com a tag da
release. O relatório completo (JSON e PDF) fica como artefato da execução por 90 dias.
