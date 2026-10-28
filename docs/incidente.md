# Procedimento de incidente com dado pessoal

O ConectAgente guarda dado de saúde, que a LGPD trata como sensível (art. 5º, II e art. 11). Quando
um incidente pode causar risco ou dano relevante ao titular, o art. 48 obriga o controlador a
comunicar a ANPD e os titulares afetados. O prazo e o conteúdo da comunicação estão no Regulamento
de Comunicação de Incidente de Segurança (Resolução CD/ANPD nº 15/2024): **três dias úteis** a
partir de quando o controlador fica sabendo que o incidente afetou dado pessoal.

Este documento é o roteiro para esses três dias. Ele não substitui o jurídico da secretaria, e os
nomes abaixo precisam ser preenchidos antes de o sistema receber dado real.

## Quem faz o quê

| Papel | Quem | Contato |
|---|---|---|
| Controlador | Secretaria Municipal de Saúde | preencher |
| Encarregado (DPO) | preencher | preencher |
| Responsável técnico | preencher | preencher |
| Quem aciona o Supabase | quem tem acesso de administrador ao projeto | preencher |

## O que conta como incidente

- Acesso a ficha de morador por quem não devia: `LEITURA_NEGADA` repetida na trilha, ou leitura de
  agente fora da própria área.
- Chave do Supabase vazada. A `publishable` é pública por desenho; a `secret` nunca pode aparecer
  fora do servidor.
- Aparelho de agente perdido ou roubado com dado que ainda não sincronizou.
- Senha de coordenador, gerente ou admin vazada ou usada de lugar estranho.
- Dado de morador encontrado onde não devia: planilha exportada, print, grupo de mensagem.

## As primeiras 24 horas

1. **Conter.** Desativar a conta envolvida no painel (`ativo = false`): desde 28/10/2026 isso
   corta na hora a leitura e a gravação, mesmo com a sessão aberta. Para impedir também que a
   pessoa renove a sessão, bloquear o usuário no Supabase, em Authentication > Users > Ban user.
   Se for chave, rotacionar no Supabase em Settings > API Keys e publicar o painel e o aplicativo
   com a nova. Se for aparelho, desativar a conta do agente: o aparelho para de sincronizar.
2. **Preservar.** Exportar a trilha (`audit_log`) do período antes de qualquer outra mudança. Ela é
   append-only, mas a exportação é o que vai anexado à comunicação.
3. **Medir.** Quais moradores foram afetados, quais campos, desde quando. A trilha responde por
   quem leu cada ficha no painel; a do aparelho, por quem abriu prontuário em campo.
4. **Registrar** tudo num documento datado: o que se sabia, quando, e o que foi feito.

## Até o terceiro dia útil

Avaliar com o encarregado se o incidente pode causar risco ou dano relevante. Dado de saúde quase
sempre pode. Se puder, comunicar:

- **À ANPD**, pelo formulário no site da autoridade, com a natureza do dado, os titulares afetados,
  as medidas tomadas e o que ainda está em apuração. Informação que faltar pode ser complementada
  depois; o prazo não espera a apuração terminar.
- **Aos titulares**, em linguagem simples, pelo canal que eles de fato usam. Para morador atendido
  por agente comunitário, muitas vezes é o próprio agente na visita.

## Depois

- Corrigir a causa, com teste que prove a correção, como foi feito com as colunas sensíveis de
  `moradores` em 28/10/2026.
- Registrar o incidente e a correção no histórico de segurança em [seguranca.md](seguranca.md).
- Revisar se o mesmo caminho existe em outra tabela.

## O que este documento não cobre

Falha de software reportada por terceiro, que ainda não virou incidente, segue o
[SECURITY.md](../SECURITY.md).
