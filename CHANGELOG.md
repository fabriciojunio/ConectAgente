# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Não Lançado]

### Adicionado
- Integração com ViaCEP para preenchimento automático de endereço
- Exportação de relatórios de visitas em PDF
- Notificações push para lembretes de visitas programadas

## [1.0.0] - 2026-05-19

### Adicionado
- App mobile React Native (Expo SDK 54) offline-first
- Portal web Next.js para gestão administrativa
- Banco local SQLite com sincronização assíncrona para Supabase
- Autenticação Supabase Auth com controle de perfis (Admin / Agente)
- Cadastro de residências, moradores e prontuários de saúde
- Agenda de visitas domiciliares com geolocalização
- Metas de cobertura da equipe de Agentes de Saúde
- Fila de sincronização com retry automático em background
- Criptografia de dados sensíveis em conformidade com LGPD
- Exportação de relatórios CSV
- Interface acessível com suporte a modo escuro
