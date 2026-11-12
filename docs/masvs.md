# OWASP MASVS 2.x: situação do aplicativo

Cada grupo do padrão de verificação de segurança de aplicativos móveis da
OWASP, com o que o aplicativo faz e onde isso é conferido. Base: versão 1.2.5.
O alvo é o **L1**, mais os itens de L2 que pesam para dado de saúde
(armazenamento e rede).

| Grupo | O que o MASVS pede | Como o aplicativo atende | Evidência | Situação |
|---|---|---|---|---|
| STORAGE-1 | dado sensível guardado com segurança | banco inteiro em SQLCipher (AES-256), chave no Keystore; token no SecureStore | `database/database.ts`, `database/chave.ts` | atende |
| STORAGE-2 | dado sensível fora de backup e de vazamento | `allowBackup: false`; log sem CPF nem dado clínico | `app.json`, revisão do código | atende |
| CRYPTO-1 | criptografia forte e atual | AES-256 do SQLCipher; PBKDF2-HMAC-SHA256 para senha; sorteio com gerador seguro | `utils/encryption.ts` | atende |
| CRYPTO-2 | gestão de chave adequada | chave de 256 bits sorteada no primeiro uso, nunca no código, guardada no Keystore | `database/chave.ts` | atende |
| AUTH-1 | autenticação segura | senha com PBKDF2 em código nativo, comparação em tempo constante, bloqueio após 5 erros | `modules/pbkdf2-nativo`, `database/limiteDeTentativas.ts` | atende |
| AUTH-2 | autenticação local quando usada | login offline por senha, revalidado com o servidor ao sincronizar | `services/authService.ts` | atende |
| AUTH-3 | operação sensível pede confirmação | troca de senha e acesso de administrador pedem a senha atual ou o código de recuperação | telas de `(auth)` | atende |
| NETWORK-1 | todo tráfego cifrado | só HTTPS; sem `usesCleartextTraffic` | configuração de rede gerada | atende |
| NETWORK-2 | identidade do servidor conferida além da loja do sistema | pino na intermediária WE1 e na raiz GTS Root R4, com data de expiração | `plugins/fixar-certificado.js`, MobSF | atende |
| PLATFORM-1 | uso seguro do que o sistema oferece | atividades de biblioteca com `exported="false"`; três permissões, todas usadas | `plugins/endurecer-manifesto.js`, `docs/mobsf.md` | atende |
| PLATFORM-2 | WebView segura | o aplicativo não usa WebView | código | não se aplica |
| PLATFORM-3 | interface não vaza dado | `FLAG_SECURE` no aplicativo inteiro (captura, gravação e miniatura dos recentes saem pretas) | `app/_layout.tsx`, teste `protecaoDeTela` | atende |
| CODE-1 | plataforma atualizada | `minSdk` 24 (Android 7) para atender aparelho antigo do agente | `docs/mobsf.md` | aceito com motivo: decisão da secretaria |
| CODE-2 | dependências sem vulnerabilidade conhecida | OSV-Scanner a cada push; aceites com motivo e prazo | `osv-scanner.toml`, workflow de segurança | atende |
| CODE-3 | entrada validada | esquemas Zod nos formulários; SQL sempre parametrizado; conversão tipada na fronteira | `utils/validators.ts`, `features/prontuario/conversoes.ts` | atende |
| CODE-4 | release sem depuração | APK assinado com a chave do projeto; build de release sem modo de depuração | `plugins/assinatura-release.js` | atende |
| RESILIENCE | resistência a engenharia reversa (L2+R) | — | — | fora do alvo: o risco principal é o aparelho perdido, coberto por STORAGE |
| PRIVACY-1 | coleta mínima | só os campos das cinco fichas de acompanhamento; foto de perfil fica no aparelho | `docs/lgpd.md` | atende |
| PRIVACY-2 | titular informado e com controle | ciência registrada no cadastro; anonimização a pedido | `docs/lgpd.md` | atende |

Teste dinâmico: o MobSF analisa o APK de cada versão publicada (nota e
triagem em [mobsf.md](mobsf.md)). Modelo de ameaças em
[modelo-de-ameacas.md](modelo-de-ameacas.md).
