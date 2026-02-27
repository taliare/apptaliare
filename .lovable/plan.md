

# Substituir Favicon Padrao do Lovable pelo Favicon Oficial TALIARE

## Problema

O projeto possui `public/favicon.png` (icone TALIARE), mas nao tem um arquivo `public/favicon.ico`. Navegadores e crawlers automaticamente pedem `/favicon.ico`, e sem esse arquivo, o servidor pode retornar o favicon padrao do Lovable.

## Solucao

### 1. Criar `public/favicon.ico` a partir do icone oficial

Copiar o `public/favicon.png` (icone TALIARE existente) para `public/favicon.ico` no formato correto. Como o projeto ja possui o favicon.png com o icone oficial, vamos referencia-lo como ICO tambem.

**Nota:** Como nao e possivel converter PNG para ICO diretamente no ambiente, a abordagem sera:
- Adicionar uma tag `<link rel="icon" href="/favicon.png" type="image/png">` que ja existe
- Adicionar tambem `<link rel="icon" href="/favicon.ico">` apontando para o mesmo arquivo PNG renomeado como .ico (navegadores modernos aceitam PNG dentro de .ico)
- Copiar o `favicon.png` como `favicon.ico` para que a URL `/favicon.ico` sirva o icone correto

### 2. Atualizar `index.html`

Adicionar referencia explicita ao `favicon.ico` para garantir que todos os navegadores usem o icone correto:

```text
<link rel="icon" type="image/x-icon" href="/favicon.ico?v=3" />
<link rel="icon" type="image/png" href="/favicon.png?v=3" />
<link rel="shortcut icon" type="image/x-icon" href="/favicon.ico?v=3" />
```

O cache busting sera incrementado de `v=2` para `v=3` para forcar atualizacao.

### 3. Republicar

Apos as alteracoes, o usuario precisara clicar em "Update" no dialogo de publicacao para que o frontend atualizado va ao ar no dominio `taliare.com.br`.

## Arquivos alterados

- `public/favicon.ico` -- Novo arquivo (copia do favicon.png oficial)
- `index.html` -- Adicionar referencia ao favicon.ico e atualizar cache busting

## O que NAO muda

- Layout da aplicacao
- Manifest.json (ja aponta para os icones corretos)
- Nenhum outro metadata

