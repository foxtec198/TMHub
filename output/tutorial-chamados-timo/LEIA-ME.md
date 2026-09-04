# Tutorial de chamados com Timo 3D

Entrega: `TMHub-Chamados-com-Timo-FullHD.mp4`, Full HD (1920×1080), 24 quadros/s, narração sintética em português e legendas incorporadas. `legendas.srt` também acompanha o vídeo. A versão FullHD inclui áudio normalizado e sete marcadores de capítulo.

## Origem e limites da demonstração

- Roteiro: `docs/tutorials/abertura-chamados/teleprompter.txt`, com as sete cenas solicitadas.
- Apresentador: modelo real `public/timo.glb`, animações `wave` e `speaking`. Não é uma imagem estática do personagem. A animação é uma interpretação de apresentação, não sincronização fonética labial.
- Voz: Microsoft Daniel, síntese local pt-BR. Não é clonagem da voz de uma pessoa.
- Conteúdo da tela: componentes reais `TicketsDashboard` e `TicketDetail`, executados em um ambiente local isolado com respostas demonstrativas. Cabeçalho e navegação simplificados para o tutorial.
- O formulário, a conversa e as buscas foram operados localmente e capturados. O vídeo usa cortes entre esses estados e enquadramentos ampliados; não é uma gravação contínua de sessão em produção.
- Filial, usuário, chamado #101 e mensagens são fictícios. A lista de motivos permanece vazia para não inventar categorias do sistema. Nenhum registro ou notificação foi enviado à produção.
- A descrição demonstrativa foi condensada visualmente. A narração mantém o texto do teleprompter.
- O prazo exibido não garante solução em 24 horas. A possibilidade de enviar mensagens depende das permissões e do status do chamado.

## Reprodução da renderização

1. Na raiz do frontend: `node output/tutorial-chamados-timo/server.mjs`.
2. Execute `capture.mjs` com Node e Playwright instalado (os caminhos locais do runtime estão declarados no script).
3. Execute `narrate.ps1` em PowerShell com a voz Microsoft Daniel disponível.
4. Execute `compose.py` com Python/Pillow. O executável FFmpeg é fornecido pelo pacote `imageio-ffmpeg` instalado na pasta local `vendor`.
5. Execute `finalize.py` para normalizar o áudio, adicionar capítulos e validar a decodificação completa do arquivo.

As dependências e os intermediários ficam nesta pasta. Não há alteração no aplicativo de produção nem publicação automática.
