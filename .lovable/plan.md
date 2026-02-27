

# Reorganizar Layout da Distribuicao de Kits

## Problema Atual
As colunas (Estoque + Representantes) usam um grid com `grid-cols-4` no desktop, fazendo com que ao ter mais de 3 representantes, as colunas extras caiam para baixo, quebrando o visual.

## Solucao

### 1. Layout Horizontal com Scroll
Trocar o grid por um layout horizontal com scroll (`flex` + `overflow-x-auto`), onde todas as colunas ficam lado a lado independente da quantidade de representantes. Cada coluna tera uma largura fixa minima (~280px) para garantir legibilidade.

### 2. Funcao de Zoom
Adicionar um controle de zoom (slider ou botoes +/-) no topo da pagina que permite ampliar ou reduzir a visualizacao das colunas. O zoom vai escalar o tamanho das colunas (largura minima) para que o usuario consiga ver mais ou menos colunas de uma vez.

## Detalhes Tecnicos

### Arquivo: `src/pages/DistribuicaoKits.tsx`

1. **Adicionar estado de zoom**: `const [zoom, setZoom] = useState(100)` (porcentagem, 50% a 150%)

2. **Adicionar controle de zoom na barra de acoes**: Botoes ZoomOut (-) e ZoomIn (+) com exibicao da porcentagem atual, usando icones do Lucide (`ZoomIn`, `ZoomOut`)

3. **Substituir o grid por flex horizontal com scroll**:
   - De: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`
   - Para: `flex gap-4 overflow-x-auto pb-4` (com scrollbar visivel)
   - Cada coluna tera `min-w-[280px]` escalado pelo zoom (ex: a 120% = 336px, a 80% = 224px)
   - Usar `flex-shrink-0` para evitar que as colunas encolham

4. **Estilizar scrollbar**: Adicionar classes para scrollbar mais visivel e amigavel
