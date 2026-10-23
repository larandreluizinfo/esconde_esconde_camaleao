# Esconde-Esconde Camaleão 🦎

Jogo web de esconde-esconde com **camuflagem**, jogado em um único dispositivo que passa de mão em mão.

**5 escondedores · 1 buscador · votação de mapa · sorteio do buscador a cada rodada**

🔗 **Jogue agora:** https://larandreluizinfo.github.io/esconde_esconde_camaleao/

## Como jogar

1. **Votação do mapa** — os 6 jogadores votam em segredo em um dos 4 cenários. Em caso de empate, o mapa é sorteado.
2. **Sorteio do buscador** — a roleta escolhe aleatoriamente quem será o buscador. Os outros 5 são os escondedores.
3. **Camuflagem (1 minuto)** — cada escondedor passa o dispositivo para o próximo e escolhe a posição e a cor do seu camaleão. A cor livre e as manchas ajudam a se misturar com o cenário.
4. **Busca (3 minutos)** — o buscador clica no mapa para procurar. Encontrar os 5 vence a rodada; se o tempo acabar antes, os escondedores vencem.

O placar acumulado aparece no fim de cada rodada.

### Controles

- **Clique / toque** no mapa para posicionar o camaleão (na camuflagem) ou procurar (na busca).
- **Arraste** para ajustar a posição.
- **Setas do teclado** movem o camaleão durante a camuflagem (`Shift` + setas move mais rápido).

## Mapas

| Mapa | Cenário |
| --- | --- |
| 🌿 Floresta Densa | Verde por todo lado |
| 🏜️ Deserto Ardente | Areia, dunas e pouca sombra |
| ❄️ Pico Nevado | Branco, gelo e sombras azuis |
| 🕳️ Caverna Sombria | Pedra escura e poças frias |

## Estrutura do projeto

```
index.html        Interface do jogo
css/style.css     Estilos e layout responsivo
js/maps.js        Cenários desenhados em canvas e paletas de camuflagem
js/game.js        Fluxo do jogo: votação, sorteio, camuflagem, busca e placar
AGENTS.md         Regras do projeto para agentes
```

Tecnologia: HTML, CSS e JavaScript puro (Canvas 2D), sem dependências. Publicado no GitHub Pages a partir da branch `main`.

## Autores

- Rafael
- João
- Elisa

## Repositório

https://github.com/larandreluizinfo/esconde_esconde_camaleao
