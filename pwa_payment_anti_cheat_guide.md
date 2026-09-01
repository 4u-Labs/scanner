# Guia Técnico: MemoVox AI — Pagamentos & Proteção Anti-Bula

Este documento serve como referência técnica para a implementação de sistemas de pagamento (Mercado Pago PIX) e proteção de bônus iniciais (Anti-Cheat) em aplicações web que priorizam privacidade e não utilizam sistemas de login tradicionais.

---

## 1. Integração Mercado Pago (PIX)

A implementação utiliza o padrão **API Bridge** para garantir que credenciais sensíveis nunca cheguem ao navegador do usuário.

### Arquitetura de Pagamento
1.  **Frontend ([index.html](file:///c:/Users/fab/Downloads/memovox/index.html))**: Utiliza apenas a `Public Key` do Mercado Pago.
2.  **Bridge de Criação ([api/mp_create_pix.php](file:///c:/Users/fab/Downloads/memovox/api/mp_create_pix.php))**:
    *   Recebe o ID do pacote e o e-mail (opcional) do cliente.
    *   Usa o `Access Token` (salvo no [.env](file:///c:/Users/fab/Downloads/memovox/.env) no servidor) para criar a preferência de pagamento via API oficial.
    *   Retorna o código `Copy/Paste` do PIX e a imagem do QR Code em Base64.
3.  **Bridge de Verificação ([api/mp_check_status.php](file:///c:/Users/fab/Downloads/memovox/api/mp_check_status.php))**:
    *   O frontend faz "polling" (consultas periódicas) a cada 5 segundos usando o ID do pagamento.
    *   O servidor consulta o status real no Mercado Pago.
    *   Se o status for `approved`, o servidor sinaliza para o frontend liberar os créditos.

### Vantagem de Segurança
*   **Zero Leak**: O `Access Token` nunca é exposto. Se o usuário inspecionar o código-fonte, ele verá apenas chamadas para a sua própria API local.

---

## 2. Sistema Anti-Cheat (IP + Fingerprint)

Como o app concede 30 créditos grátis no primeiro uso, usuários poderiam limpar o cache para ganhar créditos infinitamente. Criamos um sistema de "assinatura digital" para evitar isso sem exigir login.

### Como funciona o Fingerprint
O frontend coleta características de hardware e software que são difíceis de mudar:
*   `User Agent` (Navegador/SO)
*   `Language` (Idioma do sistema)
*   `Screen Resolution` (Pixels da tela)
*   `Timezone` (Fuso horário)
*   `Hardware Concurrency` (Núcleos do processador)
*   `Device Memory` (Quantidade de RAM)

### Protocolo de Validação ([api/check_bonus.php](file:///c:/Users/fab/Downloads/memovox/api/check_bonus.php))
1.  O Frontend gera um hash dessas informações.
2.  O Servidor recebe esse hash e detecta também o **Endereço IP**.
3.  O Servidor cria um **Super Hash** combinando `IP + Fingerprint + UserAgent`.
4.  Este Super Hash é comparado com um arquivo local (`used_bonuses.json`).
5.  **Privacidade**: O servidor nunca salva o IP ou os dados puros, apenas o Hash final. É impossível reverter o hash para descobrir quem é o usuário, mas é possível saber se aquela "assinatura" já resgatou o bônus.

---

## 3. Segurança de Arquivos e Infraestrutura

### O Padrão [.env](file:///c:/Users/fab/Downloads/memovox/.env)
Configurações sensíveis (API Keys) são salvas em um arquivo [.env](file:///c:/Users/fab/Downloads/memovox/.env). Para evitar que alguém acesse esse arquivo via URL direta (ex: `site.com/.env`), utilizamos o arquivo [.htaccess](file:///c:/Users/fab/Downloads/memovox/.htaccess):

```apache
<Files .env>
    Order allow,deny
    Deny from all
</Files>
```

### Persistência de Dados
*   **IndexedDB**: Recomendado para notas e histórico por ser assíncrono e suportar grandes volumes de dados.
*   **LocalStorage**: Usado apenas para flags simples de estado (ex: saldo de créditos atual, tema dark/light).
*   **PWA**: O [manifest.json](file:///c:/Users/fab/Downloads/memovox/manifest.json) e o [sw.js](file:///c:/Users/fab/Downloads/memovox/sw.js) (Service Worker) permitem que o app seja instalado no celular/PC e funcione offline, economizando largura de banda e melhorando a percepção de performance.

---

## 4. Dicas para Próximos Apps
*   **Export/Import**: Em apps sem login, sempre ofereça um botão de "Exportar Dados (JSON)". Se o usuário trocar de celular, ele pode importar suas notas e saldo manualmente.
*   **Logs Locais**: Mantenha um log básico de transações no `localStorage` do usuário para que ele possa conferir onde gastou os créditos.

---
*Documento gerado por Antigravity (Google DeepMind) como referência técnica para o projeto MemoVox AI.*
