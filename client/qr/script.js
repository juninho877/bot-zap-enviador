class UserSessionManager {
    constructor() {
        this.currentSecretCode = null;
        this.statusPollingInterval = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkInitialURL();
    }

    bindEvents() {
        // Formulário de código secreto (Login)
        document.getElementById('codeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCodeSubmit();
        });

        // Botão Voltar para tela de código
        document.getElementById('backToCodeBtn').addEventListener('click', () => {
            this.handleBackToCodeScreen();
        });

        // Botão Conectar / Gerar QR
        document.getElementById('connectBtn').addEventListener('click', () => {
            this.handleConnectButtonClick();
        });

        // Botão Desconectar
        document.getElementById('disconnectBtn').addEventListener('click', () => {
            this.disconnectInstance();
        });

        // Fechar modal do QR Code
        document.querySelector('#qrModal .close-button').addEventListener('click', () => {
            this.closeModal('qrModal');
        });

        // Fechar modal clicando fora
        window.addEventListener('click', (event) => {
            if (event.target === document.getElementById('qrModal')) {
                this.closeModal('qrModal');
            }
        });
    }

    checkInitialURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const secretCodeFromURL = urlParams.get('secret_code');
        if (secretCodeFromURL) {
            document.getElementById('secretCode').value = secretCodeFromURL;
            this.currentSecretCode = secretCodeFromURL;
            this.showScreen('sessionDashboardScreen');
            this.loadSessionDetails();
        } else {
            this.showScreen('codeScreen');
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
        this.showScreen('sessionDashboardScreen');
        this.loadSessionDetails();
    }

    handleBackToCodeScreen() {
        this.showScreen('codeScreen');
        this.currentSecretCode = null;
        this.stopStatusPolling();
        document.getElementById('secretCode').value = ''; // Limpa o input
        this.setSessionMessages(); // Limpa mensagens
        this.clearSessionDetails(); // Limpa detalhes da sessão
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    openModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    setSessionMessages(errorMsg = '', successMsg = '') {
        document.getElementById('sessionError').textContent = errorMsg;
        document.getElementById('sessionSuccess').textContent = successMsg;
    }

    clearSessionDetails() {
        document.getElementById('displaySecretCode').textContent = '';
        document.getElementById('sessionStatusBadge').textContent = '';
        document.getElementById('sessionStatusBadge').className = 'status-badge';
        document.getElementById('lastUpdated').textContent = '';
        document.getElementById('connectBtn').disabled = true;
        document.getElementById('disconnectBtn').disabled = true;
    }

    async loadSessionDetails() {
        if (!this.currentSecretCode) {
            this.setSessionMessages('Erro: Código secreto não definido.');
            this.showScreen('codeScreen');
            return;
        }

        this.setSessionMessages('', 'Carregando detalhes da sessão...');
        this.clearSessionDetails(); // Limpa antes de carregar

        try {
            const response = await fetch(`/qr/status/${this.currentSecretCode}`);
            const data = await response.json();

            if (data.success) {
                this.updateSessionUI(data.data);
                this.setSessionMessages('', 'Detalhes da sessão carregados.');
                this.startStatusPolling();
            } else {
                this.setSessionMessages(data.error || 'Erro ao carregar detalhes da sessão.');
                if (data.code === 'NOT_FOUND') {
                    this.showScreen('codeScreen');
                    document.getElementById('codeError').textContent = data.error;
                }
            }
        } catch (error) {
            console.error('Erro ao carregar detalhes da sessão:', error);
            this.setSessionMessages('Não foi possível conectar ao servidor para carregar detalhes da sessão.');
        }
    }

    updateSessionUI(sessionData) {
        document.getElementById('displaySecretCode').textContent = sessionData.secret_code;
        
        const statusBadge = document.getElementById('sessionStatusBadge');
        statusBadge.textContent = this.getStatusText(sessionData.status);
        statusBadge.className = `status-badge status-${sessionData.status}`;
        
        document.getElementById('lastUpdated').textContent = new Date(sessionData.updated_at).toLocaleString('pt-BR');

        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');

        if (sessionData.status === 'connected') {
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
        } else if (sessionData.status === 'connecting') {
            connectBtn.disabled = true; // Pode estar aguardando QR ou conexão
            disconnectBtn.disabled = false;
        } else { // disconnected, logged_out
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
        }
    }

    getStatusText(status) {
        const statusMap = {
            'connected': 'Conectado',
            'connecting': 'Conectando',
            'disconnected': 'Desconectado',
            'logged_out': 'Deslogado'
        };
        return statusMap[status] || status;
    }

    startStatusPolling() {
        this.stopStatusPolling(); // Garante que apenas um intervalo esteja ativo
        this.statusPollingInterval = setInterval(() => {
            this.checkConnectionStatus();
        }, 3000); // Verifica a cada 3 segundos
    }

    stopStatusPolling() {
        if (this.statusPollingInterval) {
            clearInterval(this.statusPollingInterval);
            this.statusPollingInterval = null;
        }
    }

    async checkConnectionStatus() {
        if (!this.currentSecretCode) {
            this.stopStatusPolling();
            return;
        }

        try {
            const response = await fetch(`/qr/status/${this.currentSecretCode}`);
            const data = await response.json();

            if (data.success) {
                this.updateSessionUI(data.data);
                // Se o modal de QR estiver aberto e o status mudar para conectado, fechar o modal
                if (document.getElementById('qrModal').style.display === 'flex' && data.data.status === 'connected') {
                    this.closeModal('qrModal');
                    this.setSessionMessages('', 'WhatsApp conectado com sucesso!');
                }
            } else {
                console.error('Erro ao verificar status:', data.error);
                this.setSessionMessages(data.error || 'Erro ao verificar status da conexão.');
                this.stopStatusPolling();
            }
        } catch (error) {
            console.error('Erro de rede ao verificar status:', error);
            this.setSessionMessages('Erro de rede ao verificar status. Verifique sua conexão.');
            this.stopStatusPolling();
        }
    }

    async handleConnectButtonClick() {
        if (!this.currentSecretCode) {
            this.setSessionMessages('Erro: Código secreto não definido.');
            return;
        }

        this.openModal('qrModal');
        const qrModalContent = document.getElementById('qrModalContent');
        qrModalContent.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Gerando QR Code...</p>
            </div>
        `;
        this.setSessionMessages('', 'Solicitando QR Code...');

        try {
            const response = await fetch(`/qr/connect/${this.currentSecretCode}`);
            const data = await response.json();

            if (data.success) {
                if (data.status === 'connected') {
                    qrModalContent.innerHTML = `
                        <div class="status-message status-connected">
                            ✅ WhatsApp já está Conectado!
                        </div>
                    `;
                    this.setSessionMessages('', 'WhatsApp já está conectado.');
                    this.closeModal('qrModal'); // Fecha o modal se já estiver conectado
                } else if (data.status === 'connecting' && data.data.qr_image) {
                    qrModalContent.innerHTML = `
                        <img src="${data.data.qr_image}" alt="QR Code" class="qr-image">
                    `;
                    this.setSessionMessages('', 'QR Code gerado. Escaneie para conectar.');
                    this.startStatusPolling(); // Inicia/continua a verificação de status
                } else {
                    qrModalContent.innerHTML = `
                        <div class="status-message status-connecting">
                            ⏳ Aguardando QR Code...
                        </div>
                    `;
                    this.setSessionMessages('', 'Aguardando QR Code ser gerado.');
                    this.startStatusPolling(); // Inicia/continua a verificação de status
                }
            } else {
                qrModalContent.innerHTML = `
                    <div class="status-message status-disconnected">
                        ❌ Erro ao gerar QR Code
                    </div>
                `;
                this.setSessionMessages(data.error || 'Erro desconhecido ao gerar QR Code.');
                if (data.code === 'NOT_FOUND') {
                    this.closeModal('qrModal');
                    this.showScreen('codeScreen');
                    document.getElementById('codeError').textContent = data.error;
                }
            }
        } catch (error) {
            console.error('Erro ao solicitar QR Code:', error);
            qrModalContent.innerHTML = `
                <div class="status-message status-disconnected">
                    ❌ Erro de conexão
                </div>
            `;
            this.setSessionMessages('Não foi possível conectar ao servidor para gerar QR Code.');
        }
    }

    async disconnectInstance() {
        if (!this.currentSecretCode) {
            this.setSessionMessages('Nenhuma instância selecionada para desconectar.');
            return;
        }

        if (!confirm('Tem certeza que deseja desconectar esta instância? Isso encerrará a sessão do WhatsApp.')) {
            return;
        }

        this.setSessionMessages('', 'Desconectando...');
        document.getElementById('disconnectBtn').disabled = true;
        document.getElementById('connectBtn').disabled = true;

        try {
            const response = await fetch(`/qr/disconnect/${this.currentSecretCode}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();

            if (data.success) {
                this.setSessionMessages('', 'Instância desconectada com sucesso!');
                this.updateSessionUI({
                    secret_code: this.currentSecretCode,
                    status: 'logged_out',
                    updated_at: new Date().toISOString()
                });
                this.stopStatusPolling();
            } else {
                this.setSessionMessages(`Erro ao desconectar: ${data.error || 'Erro desconhecido'}`);
                // Re-enable buttons if disconnection failed
                this.loadSessionDetails(); 
            }
        } catch (error) {
            console.error('Erro ao desconectar instância:', error);
            this.setSessionMessages('Erro de rede ao desconectar instância.');
            // Re-enable buttons if network error
            this.loadSessionDetails();
        }
    }
}

// Inicializar o gerenciador de sessão quando a página carregar
const userSessionManager = new UserSessionManager();