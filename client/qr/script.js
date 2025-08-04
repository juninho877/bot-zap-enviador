class WhatsAppConnector {
        constructor() {
            this.currentSecretCode = null;
            this.qrCheckInterval = null;
            this.init();
        }

        init() {
            this.bindEvents();
            this.checkInitialURL();
        }

        bindEvents() {
            // Formulário de código secreto
            document.getElementById('codeForm').addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCodeSubmit();
            });

            // Botão Voltar
            document.getElementById('backBtn').addEventListener('click', () => {
                this.handleBackToCodeScreen();
            });

            // Botão Atualizar QR
            document.getElementById('refreshQrBtn').addEventListener('click', () => {
                this.loadQRCode(true); // Força a atualização
            });

            // Botão Desconectar
            document.getElementById('disconnectBtn').addEventListener('click', () => {
                this.disconnectInstance();
            });
        }

        checkInitialURL() {
            const urlParams = new URLSearchParams(window.location.search);
            const secretCodeFromURL = urlParams.get('secret_code');
            if (secretCodeFromURL) {
                document.getElementById('secretCode').value = secretCodeFromURL;
                this.currentSecretCode = secretCodeFromURL;
                this.showQRScreen();
                this.loadQRCode();
            } else {
                this.showCodeScreen();
            }
        }

        handleCodeSubmit() {
            const secretCodeInput = document.getElementById('secretCode');
            const secretCode = secretCodeInput.value.trim();
            const errorDiv = document.getElementById('codeError');

            if (!secretCode) {
                errorDiv.textContent = 'Por favor, digite um código secreto.';
                return;
            }

            this.currentSecretCode = secretCode;
            errorDiv.textContent = ''; // Limpa qualquer erro anterior
            this.showQRScreen();
            this.loadQRCode();
        }

        handleBackToCodeScreen() {
            this.showCodeScreen();
            this.currentSecretCode = null;
            this.stopQRCheck();
            this.clearQRContent();
            document.getElementById('secretCode').value = ''; // Limpa o input
            document.getElementById('qrError').textContent = '';
            document.getElementById('qrSuccess').textContent = '';
        }

        showCodeScreen() {
            document.getElementById('codeScreen').classList.add('active');
            document.getElementById('qrScreen').classList.remove('active');
        }

        showQRScreen() {
            document.getElementById('codeScreen').classList.remove('active');
            document.getElementById('qrScreen').classList.add('active');
        }

        clearQRContent() {
            const qrContent = document.getElementById('qrContent');
            qrContent.innerHTML = '';
        }

        setQRContent(html) {
            const qrContent = document.getElementById('qrContent');
            qrContent.innerHTML = html;
        }

        setQRMessages(errorMsg = '', successMsg = '') {
            document.getElementById('qrError').textContent = errorMsg;
            document.getElementById('qrSuccess').textContent = successMsg;
        }

        async loadQRCode(forceRefresh = false) {
            if (!this.currentSecretCode) {
                this.setQRMessages('Erro: Código secreto não definido.');
                this.showCodeScreen();
                return;
            }

            this.setQRContent(`
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <p>Carregando QR Code...</p>
                </div>
            `);
            this.setQRMessages(); // Limpa mensagens anteriores
            this.stopQRCheck(); // Para qualquer verificação anterior

            try {
                const response = await fetch(`/qr/connect/${this.currentSecretCode}`);
                const data = await response.json();

                if (data.success) {
                    if (data.status === 'connected') {
                        this.setQRContent(`
                            <div class="status-message status-connected">
                                ✅ WhatsApp Conectado!
                            </div>
                            <p class="qr-instructions">Você já pode enviar mensagens.</p>
                        `);
                        this.setQRMessages('', 'Conectado com sucesso!');
                        document.getElementById('refreshQrBtn').disabled = true;
                    } else if (data.status === 'connecting' && data.data.qr_image) {
                        this.setQRContent(`
                            <img src="${data.data.qr_image}" alt="QR Code" class="qr-image">
                            <p class="qr-instructions">Escaneie este QR Code com seu celular para conectar o WhatsApp.</p>
                        `);
                        this.setQRMessages('', 'QR Code gerado. Escaneie para conectar.');
                        document.getElementById('refreshQrBtn').disabled = false;
                        this.startQRCheck(); // Inicia a verificação de status
                    } else {
                        this.setQRContent(`
                            <div class="status-message status-connecting">
                                ⏳ Aguardando QR Code...
                            </div>
                            <p class="qr-instructions">Aguarde enquanto o QR Code é gerado.</p>
                        `);
                        this.setQRMessages('', 'Aguardando QR Code...');
                        document.getElementById('refreshQrBtn').disabled = false;
                        this.startQRCheck(); // Inicia a verificação de status
                    }
                } else {
                    this.setQRContent(`
                        <div class="status-message status-disconnected">
                            ❌ Erro ao carregar QR Code
                        </div>
                    `);
                    this.setQRMessages(data.error || 'Erro desconhecido ao carregar QR Code.');
                    document.getElementById('refreshQrBtn').disabled = false;
                    if (data.code === 'NOT_FOUND') {
                        // Se o código não for encontrado, volta para a tela inicial
                        this.showCodeScreen();
                        document.getElementById('codeError').textContent = data.error;
                    }
                }
            } catch (error) {
                console.error('Erro ao carregar QR Code:', error);
                this.setQRContent(`
                    <div class="status-message status-disconnected">
                        ❌ Erro de conexão
                    </div>
                `);
                this.setQRMessages('Não foi possível conectar ao servidor. Tente novamente.');
                document.getElementById('refreshQrBtn').disabled = false;
            }
        }

        startQRCheck() {
            this.stopQRCheck(); // Garante que apenas um intervalo esteja ativo
            this.qrCheckInterval = setInterval(() => {
                this.checkConnectionStatus();
            }, 3000); // Verifica a cada 3 segundos
        }

        stopQRCheck() {
            if (this.qrCheckInterval) {
                clearInterval(this.qrCheckInterval);
                this.qrCheckInterval = null;
            }
        }

        async checkConnectionStatus() {
            if (!this.currentSecretCode) {
                this.stopQRCheck();
                return;
            }

            try {
                const response = await fetch(`/qr/status/${this.currentSecretCode}`);
                const data = await response.json();

                if (data.success) {
                    if (data.data.status === 'connected') {
                        this.setQRContent(`
                            <div class="status-message status-connected">
                                ✅ WhatsApp Conectado!
                            </div>
                            <p class="qr-instructions">Você já pode enviar mensagens.</p>
                        `);
                        this.setQRMessages('', 'Conectado com sucesso!');
                        document.getElementById('refreshQrBtn').disabled = true;
                        this.stopQRCheck(); // Para de verificar quando conectado
                    } else if (data.data.status === 'logged_out' || data.data.status === 'disconnected') {
                        this.setQRContent(`
                            <div class="status-message status-disconnected">
                                ❌ Desconectado
                            </div>
                            <p class="qr-instructions">Sua sessão foi desconectada. Por favor, gere um novo QR Code ou verifique o código secreto.</p>
                        `);
                        this.setQRMessages('Sessão desconectada. Tente novamente.', '');
                        document.getElementById('refreshQrBtn').disabled = false;
                        this.stopQRCheck(); // Para de verificar quando desconectado
                    } else if (data.data.status === 'connecting' && !document.querySelector('.qr-image')) {
                        // Se estiver conectando mas o QR não apareceu, tenta carregar o QR novamente
                        this.loadQRCode();
                    }
                } else {
                    console.error('Erro ao verificar status:', data.error);
                    // Se houver erro na verificação de status, pode ser que a instância não exista mais
                    this.setQRMessages(data.error || 'Erro ao verificar status da conexão.');
                    this.stopQRCheck();
                }
            } catch (error) {
                console.error('Erro de rede ao verificar status:', error);
                this.setQRMessages('Erro de rede ao verificar status. Verifique sua conexão.');
                this.stopQRCheck();
            }
        }

        async disconnectInstance() {
            if (!this.currentSecretCode) {
                alert('Nenhuma instância selecionada para desconectar.');
                return;
            }

            if (!confirm('Tem certeza que deseja desconectar esta instância?')) {
                return;
            }

            try {
                const response = await fetch(`/qr/disconnect/${this.currentSecretCode}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                const data = await response.json();

                if (data.success) {
                    alert('Instância desconectada com sucesso!');
                    this.handleBackToCodeScreen(); // Volta para a tela de código
                } else {
                    alert(`Erro ao desconectar: ${data.error || 'Erro desconhecido'}`);
                }
            } catch (error) {
                console.error('Erro ao desconectar instância:', error);
                alert('Erro de rede ao desconectar instância.');
            }
        }
    }

    // Inicializar o conector quando a página carregar
    const whatsAppConnector = new WhatsAppConnector();