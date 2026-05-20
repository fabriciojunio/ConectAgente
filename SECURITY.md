# Política de Segurança

## Versões Suportadas

| Versão | Suporte |
|--------|---------|
| 1.x    | ✅ Ativo |

## Reportando Vulnerabilidades

Envie um e-mail para **junioad555@gmail.com** com assunto **[SECURITY] ConectAgente**.

Resposta em até **72 horas**.

## Conformidade com LGPD

O ConectAgente lida com dados sensíveis de saúde de cidadãos brasileiros.

### Medidas Adotadas

- **Criptografia local**: dados de prontuário são criptografados com AES-256 antes do armazenamento SQLite
- **Transmissão segura**: toda comunicação usa TLS 1.3
- **Minimização de dados**: apenas informações necessárias para o ACS são coletadas
- **Controle de acesso**: RBAC com perfis Admin e Agente
- **Auditoria**: log de acesso a prontuários sensíveis
- **Direito ao esquecimento**: remoção de dados implementada via `lgpd.ts`
