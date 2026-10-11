## Descrição

<!-- O que foi feito e por quê? Se corrige defeito, diga como foi medido. -->

## Tipo de mudança

- [ ] Correção de defeito
- [ ] Nova funcionalidade
- [ ] Refatoração
- [ ] Melhoria de performance
- [ ] Segurança
- [ ] Documentação

## Módulo afetado

- [ ] `ConectAgente-mobile` (aplicativo React Native)
- [ ] `ConectAgente-web` (painel administrativo)
- [ ] Banco de dados (schema ou migração)
- [ ] Mais de um

## Checklist

- [ ] Testes passando nos módulos afetados
- [ ] TypeScript sem erros (`npx tsc --noEmit`)
- [ ] ESLint sem avisos (painel)
- [ ] Sem `.env`, sem credencial e sem chave no diff
- [ ] CHANGELOG.md atualizado

## Mexeu em schema ou em migração?

Então rode as suítes de banco. Elas sobem um PostgreSQL descartável, aplicam o
schema e as migrações, reproduzem um caminho real e se autodestroem.

```bash
bash ConectAgente-web/supabase/testes/rodar-todos.sh
```

- [ ] As três suítes passam

Não é formalidade. Teste de unidade não pega divergência entre o schema do
aparelho e o do servidor, porque cada lado fica coerente consigo mesmo e o erro
mora na junta. Foi assim que se descobriu que 61 colunas de dado clínico não
tinham destino no servidor, com os testes de unidade todos verdes.

Três testes de contrato apontam a divergência, se houver:

| Teste | Compara |
|---|---|
| `contratoSync.test.ts` | schema do aparelho contra o do servidor |
| `sqlDosRepositorios.test.ts` | o SQL dos repositórios contra o schema local |
| `contratoPapeis.test.ts` | os papéis do código contra os CHECK do banco |

## Mexeu em dependência?

- [ ] `npm audit --omit=dev` segue em zero no painel
- [ ] O aplicativo ainda empacota (`npx expo export --platform android`)

O empacotamento é o que pega override que quebra o Metro. Já aconteceu com
`image-size` 2.x e `uuid` 11.x.

## Testes em dispositivo

- [ ] Android (Expo Go ou emulador)
- [ ] iOS (Expo Go ou simulador)
- [ ] Navegador (painel)

## Mexeu em dado pessoal sensível?

O prontuário é dado sensível pelo art. 5º, II da LGPD.

- [ ] Li [docs/lgpd.md](../docs/lgpd.md) e não afirmei conformidade que o código
      não tem
- [ ] A policy de RLS cobre a tabela nova, se houver
- [ ] O guarda de tela casa com a policy do banco
