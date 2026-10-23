# AGENTS.md

Instruções para agentes de IA que trabalham neste repositório.

## Regra obrigatória: commitar e dar push em toda alteração

Toda e qualquer alteração neste repositório **deve** ser:

1. **Comitada** com uma mensagem clara e descritiva.
2. **Enviada (`push`)** para o remoto na branch `main`.

Nenhuma tarefa é considerada concluída enquanto as alterações não estiverem
comitadas e publicadas no GitHub.

### Fluxo padrão

```bash
git add -A
git commit -m "descrição curta da alteração"
git push origin main
```

### Observações

- Commits devem ser pequenos, focados e com mensagens no imperativo
  (ex.: `adiciona página inicial`).
- Não deixe trabalho não commitado ao final de uma tarefa.
- O site é publicado pelo GitHub Pages a partir da branch `main` (raiz do repositório),
  então todo `push` na `main` gera uma nova publicação.
- Antes de comitar, verifique que não há segredos, credenciais ou arquivos temporários
  sendo adicionados.

## Publicação

- Site: https://larandreluizinfo.github.io/esconde_esconde_camaleao/
- Branch de publicação: `main`
- Diretório de publicação: `/` (raiz)

## Autores

Rafael, João e Elisa.
