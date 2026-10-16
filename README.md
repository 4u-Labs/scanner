# 📄 DocScan Pro — Digitalizador Inteligente de Documentos, OCR IA & Impressão Térmica

<div align="center">

![DocScan](https://img.shields.io/badge/DocScan_Pro-v4.0_Vision-0ea5e9?style=for-the-badge&logo=camscanner&logoColor=white)
![Computer Vision](https://img.shields.io/badge/Engine-Perspective_Crop_%26_Sauvola-10b981?style=for-the-badge&logo=opencv&logoColor=white)
![OCR IA](https://img.shields.io/badge/OCR_IA-Tesseract_%26_Febraban-6d4aff?style=for-the-badge)
![Thermal](https://img.shields.io/badge/Impressão-Térmica_80mm-ff6b6b?style=for-the-badge)

<br><br>

[**📄 Acessar DocScan Pro Online**](https://4u.ia.br/app/scanner/) • [**4U.IA.BR**](https://4u.ia.br)

</div>

---

## ⚡ Visão Geral

O **DocScan Pro** é uma solução completa de digitalização e processamento de documentos direto na web, transformando a câmera do celular ou fotos de documentos em PDFs de qualidade profissional com contraste aprimorado (Sauvola), corte automático em 4 pontos com lupa de precisão, extração de texto por OCR com IA, assinatura touch, leitura de boletos Febraban e impressão térmica (80mm).

### 🌟 Principais Recursos:
* 📐 **Detecção de Bordas & Perspectiva 4 Pontos:** Correção geométrica e enquadramento perfeito com lupa flutuante de precisão e auto-disparo.
* 🪄 **Filtros Profissionais & Sauvola:** Modos P&B Limpo, Binarização Sauvola adaptativa, Alto Contraste, Escala de Cinza e Realce de Cores.
* 📝 **OCR IA & Boletos Febraban:** Reconhecimento óptico de caracteres multilíngue e leitura/validação instantânea de código de barras de boletos.
* ✍️ **Assinatura Touch & Carimbos:** Assinador digital integrado na tela com ajuste de espessura/cor, carimbos personalizáveis e tarjas de segurança.
* 🖨️ **Impressão Térmica 80mm & PDF:** Geração de bobinas para impressoras térmicas (Bematech MP-4200 TH / ESC-POS) e pranchas multipáginas em PDF.
* ☁️ **Google Drive & Pagamentos:** Sincronização direta com Google Drive e compra de créditos IA via PIX e PayPal.
* 📱 **PWA & Acesso Offline:** Após a primeira instalação completa (aprox. 60 MB de bibliotecas locais), câmera, edição, PDF e OCR local funcionam sem rede; Google Drive, login e OCR com IA exigem conexão. Documentos ficam no IndexedDB do aparelho; faça backup para evitar perdas ao limpar os dados do navegador.

---

## 💻 Stack Tecnológica

* **Processamento de Imagem:** HTML5 Canvas, WebGL, Binarização Adaptativa Sauvola, Filtros Matriciais
* **IA & OCR:** Tesseract.js Client-side, ZXing / Leitor de Código de Barras Febraban
* **Frontend & PWA:** JavaScript ES6+ Vanilla, CSS3 Glassmorphism, Service Workers com cache offline
* **Geração & Impressão:** jsPDF Engine, driver de impressão térmica ESC-POS/80mm

---

## 📄 Licença & Termos de Uso / License

Este projeto é distribuído sob o modelo **Source-Available** (código disponível publicamente para consulta, aprendizado e auditoria técnica).

* ✅ **Permitido:** Estudo pessoal, aprendizado, testes locais e auditoria de código.
* ❌ **Proibido:** Uso comercial (direto ou indireto), redistribuição, revenda ou criação de produtos derivados sem autorização prévia por escrito.

Todos os direitos autorais e patrimoniais pertencem à **4U** (4u.ia.br). Para detalhes completos e condições legais, consulte o arquivo [LICENSE](LICENSE).

Para parcerias ou licenciamento de uso comercial do motor do DocScan Pro, entre em contato através de [4u.ia.br](https://4u.ia.br).