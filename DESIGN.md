---
name: Vitalis Mobile
description: Rotina medicamentosa clara, humana e conectada.
colors:
  canvas: "#F8F6F0"
  ink: "#141413"
  body-strong: "#252523"
  muted: "#5F5B54"
  muted-soft: "#7F7A70"
  surface: "#FFFDF8"
  surface-soft: "#F1EEE6"
  surface-card: "#EBE6DC"
  surface-dark: "#11191F"
  surface-dark-elevated: "#17252D"
  line: "#E3DDD2"
  line-strong: "#D4CCB8"
  brand: "#1565D8"
  brand-strong: "#0D4FB0"
  brand-soft: "#D9E9FF"
  success: "#1F9D67"
  success-soft: "#DFF5EA"
  warning: "#B26A00"
  warning-soft: "#FFF3D6"
  danger: "#B42318"
  danger-soft: "#FEE4E2"
typography:
  display:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.8px"
  headline:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.5px"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.35
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  card: "20px"
  xl: "24px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  ml: "20px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "14px 20px"
    height: "54px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brand-strong}"
    rounded: "{rounded.md}"
    padding: "14px 20px"
    height: "54px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
    height: "52px"
---

# Design System: Vitalis Mobile

## Overview

**Direção refinada: "Precisão silenciosa".** A sofisticação vem de hierarquia previsível, espaço editorial, tipografia funcional e feedback honesto. Métricas e horários usam Inter com algarismos tabulares; a Cormorant fica reservada para títulos narrativos. Superfícies elevadas são raras, animações respondem a uma ação e o layout adapta os respiros entre celulares compactos, celulares amplos e tablets.

**Creative North Star: "Continuidade Vital"**

A interface transporta para o celular a narrativa de continuidade da landing page: o fundo creme editorial é o território de confiança, o azul Vitalis indica ação e orientação, o verde confirma continuidade e os planos escuros concentram a inteligência do IA HUB. A cápsula deixa de ser um objeto 3D e vira uma linguagem de forma, ritmo e progressão.

O app deve parecer um produto de cuidado já operacional, não uma coleção de telas demonstrativas. Cada superfície precisa mostrar dados reais, estados vazios honestos, feedback de carregamento e ações reversíveis ou claramente confirmadas. Rejeita dashboards genéricos de SaaS, excesso previsível de cards, gradientes roxos de IA, glassmorphism decorativo e texto pequeno.

**Key Characteristics:**

- Canvas creme editorial com tipografia escura de alto contraste.
- Cormorant Garamond para momentos narrativos; Inter para toda leitura e operação.
- Azul usado como ação primária, verde como confirmação e nunca como decoração indiscriminada.
- IA HUB apresentada em superfície escura, conectada aos dados do usuário e com limites médicos explícitos.
- Hierarquia baseada em uma próxima ação dominante por tela.
- Ritmo de 4/8 pontos, áreas de toque amplas e movimento curto com significado.

## Colors

A paleta preserva a trindade da landing: creme quente, azul clínico e verde de continuidade, com carvão profundo para a camada conversacional.

### Primary

- **Azul Vitalis** (#1565D8): ação principal, seleção, foco e progressão.
- **Azul Profundo** (#0D4FB0): texto acionável e estados pressionados.
- **Azul Neblina** (#D9E9FF): seleção suave e realce de contexto.

### Secondary

- **Verde Continuidade** (#1F9D67): confirmação de dose, sucesso e conexão ativa.
- **Verde Calmo** (#DFF5EA): superfícies de sucesso sem perda de legibilidade.

### Neutral

- **Creme Editorial** (#F8F6F0): canvas principal; nunca substituir por branco puro.
- **Papel Vitalis** (#FFFDF8): inputs e cartões operacionais.
- **Tinta Quente** (#141413): títulos e texto primário.
- **Carvão HUB** (#11191F): superfície do assistente e momentos de alta concentração.
- **Linha Mineral** (#E3DDD2): divisores e bordas discretas.

**The Scarce Color Rule.** Azul e verde têm função; a maior parte de cada tela permanece neutra para que estados importantes tenham voz.

## Typography

**Display Font:** Cormorant Garamond (com Georgia como fallback)
**Body Font:** Inter (com fonte do sistema como fallback)
**Label Font:** Inter

**Character:** O display serifado traz humanidade e memória editorial; o sans humanista mantém horários, doses e instruções rápidos de ler.

### Hierarchy

- **Display** (600, 40px, 1.05): mensagens de abertura e grandes estados de cuidado.
- **Headline** (600, 32px, 1.12): título principal de cada tela.
- **Title** (600, 18px, 1.35): medicamentos, grupos e decisões.
- **Body** (400, 16px, 1.55): texto operacional e explicações.
- **Label** (600, 13px, 1.35): campos, metadados e chips; maiúsculas apenas em sobrancelhas curtas.

**The Read-at-a-Glance Rule.** Horários e métricas usam algarismos tabulares e jamais ficam abaixo de 14px.

## Elevation

O sistema é tonal primeiro e elevado apenas quando a interação exige prioridade. Cartões regulares usam borda mineral de 1px; a próxima dose e menus flutuantes podem receber sombra ambiente suave. A camada escura cria profundidade por contraste, não por brilho.

### Shadow Vocabulary

- **Ambient Low** (`0 1px 3px rgba(20,20,19,0.08)`): separação mínima de cartões tocáveis.
- **Lift** (`0 18px 48px rgba(17,25,31,0.12)`): próxima dose, folhas e ações flutuantes.

**The Flat-by-Default Rule.** Sombras aparecem por prioridade ou estado, nunca como decoração repetida em todos os cartões.

## Components

### Buttons

- **Shape:** retângulo confortável de 12px com altura mínima de 52px.
- **Primary:** azul Vitalis, texto creme, peso 700 e apenas uma ação primária por tela.
- **Hover / Focus:** no toque, reduz opacidade sem deslocar layout; foco recebe anel azul visível.
- **Secondary:** papel creme, borda mineral e texto azul profundo.

### Chips

- **Style:** cápsulas de 40–44px de altura, texto explícito e borda; cor nunca é o único indicador.
- **State:** selecionado usa azul suave com borda azul e estado `selected` anunciado ao leitor de tela.

### Cards / Containers

- **Corner Style:** 16px em superfícies regulares e 24px apenas em momentos hero.
- **Background:** papel, creme suave ou carvão HUB conforme hierarquia.
- **Shadow Strategy:** borda primeiro; sombra apenas para prioridade.
- **Internal Padding:** 16–24px no celular e até 32px no tablet.

### Inputs / Fields

- **Style:** altura mínima de 52px, rótulo sempre visível, papel creme e borda mineral.
- **Focus:** borda azul e anel leve; teclado apropriado para e-mail e números.
- **Error / Disabled:** mensagem junto ao campo; vermelho com ícone/texto, nunca só cor.

### Navigation

A navegação inferior tem no máximo cinco destinos, ícones da mesma família e rótulos sempre visíveis. O estado ativo combina ícone, texto e cor. Conteúdo reserva espaço para área segura e barra inferior.

### Next Dose Card

É o componente assinatura: horário dominante, medicamento, dosagem, instrução curta, estado inequívoco e uma única ação de confirmação. Sua composição deriva da cápsula dividida em informação e ação.

## Do's and Don'ts

### Do:

- **Do** usar #F8F6F0 como canvas e #FFFDF8 para superfícies operacionais.
- **Do** manter texto primário #141413 e corpo com pelo menos 16px nas áreas centrais.
- **Do** exibir carregamento, vazio, sucesso e erro em todo fluxo assíncrono.
- **Do** garantir alvos de toque de pelo menos 44×44 pontos e 8px entre controles adjacentes.
- **Do** manter IA HUB transparente sobre origem dos dados e limites médicos.
- **Do** manter uma ação primária clara por tela.

### Don't:

- **Don't** criar dashboards genéricos de SaaS ou grades repetitivas de cards sem hierarquia.
- **Don't** usar excesso previsível de azul e verde, gradientes roxos de “IA” ou glassmorphism decorativo.
- **Don't** usar texto pequeno, baixo contraste, controles sem função ou estados falsos.
- **Don't** permitir que a IA pareça diagnosticar, prescrever ou inventar informações médicas.
- **Don't** usar animação decorativa desconectada de causa, estado ou continuidade.
- **Don't** usar emojis como ícones estruturais.
