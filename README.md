# Vitalis Mobile

Aplicativo de organização e acompanhamento de medicamentos para pacientes, pessoas idosas, cuidadores e familiares. A Vitalis reúne agenda diária, confirmação de doses, histórico, indicadores de adesão e uma interface conversacional conectada aos mesmos dados.

> A Vitalis apoia a organização da rotina e não substitui prescrição ou orientação médica.

## Funcionalidades

- Autenticação real com e-mail e senha pelo Supabase Auth.
- Sessão persistente no dispositivo.
- Cadastro atômico de medicamentos e horários recorrentes.
- Agenda diária calculada com dados reais da conta.
- Confirmação e registro de doses tomadas ou não tomadas.
- Histórico protegido por usuário.
- Monitoramento de adesão em 7 ou 30 dias.
- Gestão de medicamentos ativos e pausados.
- Duração de tratamento por período ou uso contínuo.
- IA HUB determinística para consultar próxima dose, agenda, medicamentos e adesão.
- Cadastro guiado de medicamentos pelo IA HUB, com confirmação antes de persistir.
- Design system próprio alinhado à landing page Vitalis.

## Repositório relacionado

A landing page e o Dashboard web da Vitalis estão em [vitalis-website](https://github.com/EspanholHS/vitalis-website).

## Stack

- Expo 54, React Native 0.81 e React 19.
- Expo Router e React Navigation.
- TypeScript em modo estrito.
- Supabase Auth + Postgres + Row Level Security.
- Expo SQLite para persistência segura da sessão local.
- Cormorant Garamond, Inter e Sora via Expo Google Fonts.

## Configuração local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env.local` e preencha somente as credenciais públicas:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
   ```

3. Inicie o app:

   ```bash
   npm start
   ```

   Ou execute diretamente:

   ```bash
   npm run android
   npm run ios
   npm run web
   ```

As variáveis `EXPO_PUBLIC_*` são embarcadas no cliente e devem conter apenas a URL e a chave publicável. Nunca adicione uma chave `service_role`, secret key ou token administrativo ao app.

## Banco de dados

As migrações versionadas ficam em `supabase/migrations/` e criam:

- `profiles`
- `medications`
- `medication_schedules`
- `dose_events`
- `chat_sessions`
- `chat_messages`

Todas as tabelas públicas têm RLS habilitada e políticas por `auth.uid()`. O papel `anon` não recebe acesso às tabelas. O cadastro de medicamento e de seus horários ocorre pela função transacional `create_medication_with_schedules`.

Para aplicar a estrutura em outro projeto Supabase, use a CLI ou o painel SQL seguindo a ordem dos arquivos em `supabase/migrations/`. Depois, gere novamente `types/database.ts` a partir do schema remoto.

## Estrutura

```text
app/                    telas e rotas
  (tabs)/               Hoje, Progresso, IA HUB, Histórico e Perfil
components/             componentes do design system Vitalis
constants/              tokens de cor, tipografia, espaçamento e forma
contexts/               sessão e autenticação
lib/                    cliente Supabase e camada de dados
supabase/migrations/    schema, políticas e funções versionadas
types/database.ts       tipos gerados pelo Supabase
```

## Qualidade

```bash
npm run lint
npx tsc --noEmit
npm run test:hub
npx expo export --platform android
```

O repositório inclui `.env.example`, mas ignora `.env`, `.env.local` e qualquer outro arquivo `.env.*` real.

## Documentação de produto e design

- `PRODUCT.md` registra usuários, propósito, limites e princípios.
- `DESIGN.md` documenta o sistema visual em formato compatível com Google Stitch.

## Licença

Projeto acadêmico Vitalis. Consulte a equipe antes de reutilizar identidade, textos ou assets.
