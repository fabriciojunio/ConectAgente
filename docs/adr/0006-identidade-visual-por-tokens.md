# 6. Identidade visual do painel por tokens semânticos

Data: 2026-11-12
Situação: aceita

## Contexto

O painel usava o azul padrão e mais de 300 classes de cor fixa (`bg-red-50`,
`text-green-600`) espalhadas pelas páginas. No tema escuro elas viravam blocos
claros, e o painel não lembrava o aplicativo que a coordenação já usa.

## Decisão

O painel usa o roxo da área de administração do aplicativo (#4A148C, #7B1FA2,
#AB47BC). As cores viram tokens por papel (fundo, borda, forte e texto) em
sete famílias (primária, erro, sucesso, alerta, atenção, informação e rosa),
com valores próprios no claro e no escuro, em canais RGB para o Tailwind
aplicar opacidade. As paletas do Tailwind apontam para os tokens, então uma
classe antiga segue o tema sem ser reescrita.

## Consequências

**O que se ganha.** Uma troca de cor acontece num arquivo (`globals.css`), o
tema escuro funciona em todas as páginas e o contraste fica dentro do AA.

**O que se perde.** `bg-red-50` deixa de ser vermelho literal e passa a ser
"fundo de erro". Quem chega ao código precisa saber disso, e é o que este
registro diz.
