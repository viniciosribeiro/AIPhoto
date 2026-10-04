# Eleições Brasil 2026 – painel ao vivo

Site estático (HTML/CSS/JS, sem build). Abra `index.html` por qualquer servidor estático (`python3 -m http.server`) ou publique no GitHub Pages.

- **Apuração em tempo real**: JSON público do TSE, atualizado a cada 30 s no navegador. Informe o código da eleição em ⚙ (ex.: `544` = 1º turno 2022; use "Replay 2022" para testar).
- **Mapa interativo**: malha do IBGE (Leaflet) + cartograma; camadas, filtros por região/candidato/busca; detalhe por estado.
- **Previsões**: média ponderada de pesquisas, Monte Carlo, 2º turno com migração ajustável, projeção por estado.
- **Pesquisas**: filtros, gráfico, adição manual, export CSV. Dados em `js/data.js`.
- **Estados**: tabela filtrável/ordenável com export CSV. Modo claro/escuro, responsivo.
