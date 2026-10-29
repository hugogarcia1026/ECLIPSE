# ECLIPSE: ECOS DOS COLOSSOS

Jogo 3D de ação e aventura (projeto escolar). **Estado atual: Fase 1 — projeto mínimo executável.**

## Pré-requisitos

- Node.js **20.19 ou superior** (ou 22.12+). Verifique com `node -v`.
- Navegador com WebGL (Chrome, Edge ou Firefox atualizados).

## Instalação e execução (Windows / VS Code)

No terminal do VS Code (`Ctrl + '`), dentro da pasta `ECLIPSE`:

```
npm install
npm run dev
```

O navegador abre em `http://localhost:5173`. Para parar: `Ctrl + C` no terminal.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (abre o navegador) |
| `npm test` | Testes automáticos da Fase 1 |
| `npm run build` | Gera a versão de produção em `dist/` |
| `npm run preview` | Serve a versão de `dist/` |

## Controles (Fase 1)

- Arrastar com o botão do mouse: girar a câmera
- Roda do mouse: aproximar/afastar

## Estado das funcionalidades

| Item | Estado |
|---|---|
| Cena 3D procedural: relevo, lago, floresta, céu de pôr do sol, sombras, ruínas e núcleo do Pulso | Implementado e testado (NullEngine + build + servidor) |
| Renderização real na GPU | Pendente de verificação visual no seu computador |
| Personagem, combate, colossos, IA, multiplayer | Planejado (fases 2 a 5) |

## Problemas conhecidos

- O build gera um aviso de chunk maior que 500 kB (é o Babylon.js). Não afeta o funcionamento.
