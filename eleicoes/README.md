# Eleições Brasil 2026 – painel ao vivo

Site estático (HTML/CSS/JS, sem build). Abra `index.html` por qualquer servidor estático (`python3 -m http.server`) ou publique no GitHub Pages.

- **Apuração em tempo real**: JSON público do TSE no leiaute EA20 (`/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json`), atualizado a cada 30 s no navegador. O código 6257 (1º turno) ou 6258 (2º turno) é detectado sozinho; outro código pode ser definido em ⚙. "Replay 2022" usa o arquivo antigo de 2022 (`dados-simplificados/…-r.json`, código `544`).
- **Mapa interativo**: malha do IBGE (Leaflet) + cartograma; camadas, filtros por região/candidato/busca; detalhe por estado.
- **Previsões**: média ponderada de pesquisas, Monte Carlo, 2º turno com migração ajustável, projeção por estado.
- **Pesquisas**: filtros, gráfico, adição manual, export CSV. Dados em `js/data.js`.
- **Estados**: tabela filtrável/ordenável com export CSV. Modo claro/escuro, responsivo.
