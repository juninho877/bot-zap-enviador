class UserSessionManager {
    constructor() {
        this.currentSecretCode = null;
        this.statusPollingInterval = null;
        this.init();
    }

    init() {
        console.log('🚀 [USER-SESSION] Inicializando UserSessionManager');
        this.bindEvents();
        this.checkInitialURL();
    }

    bindEvents() {
        // Formulário de login
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Botão logout (trocar código)
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Botão conectar
        document.getElementById('connectBtn').addEventListener('click', () => {
            this.handleConnect();
        });

        // Botão desconectar
        document.getElementById('disconnectBtn').addEventListener('click', () => {
            this.handleDisconnect();
        });

        // Fechar modal
        document.querySelector('#qrModal .close-button').addEventListener('click', () => {
            this.closeModal();
        });

        // Fechar modal clicando fora
        window.addEventListener('click', (event) => {
            if (event.target === document.getElementById('qrModal')) {
                this.closeModal();
            }
        });
    }

    checkInitialURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const secretCodeFromURL = urlParams.get('secret_code');
        
        if (secretCodeFromURL) {
            console.log('🔗 [USER-SESSION] Código encontrado na URL:', secretCodeFromURL);
            document.getElementById('secretCode').value = secretCodeFromURL;
            this.currentSecretCode = secretCodeFromURL;
            this.showSessionPanel();
            this.loadSessionStatus();
        } else {
            console.log('📝 [USER-SESSION] Mostrando tela de login');
            this.showLoginScreen();
        }
    }

    handleLogin() {
        const secretCodeInput = document.getElementById('secretCode');
        const secretCode = secretCodeInput.value.trim();
        const errorDiv = document.getElementById('loginError');

        console.log('🔐 [USER-SESSION] Tentativa de login com código:', secretCode);

        if (!secretCode) {
            errorDiv.textContent = 'Por favor, digite um código secreto.';
            return;
        }

        this.currentSecretCode = secretCode;
        errorDiv.textContent = '';
        
        console.log('✅ [USER-SESSION] Login realizado, mostrando painel');
        this.showSessionPanel();
        this.loadSessionStatus();
    }

    handleLogout() {
        console.log('🚪 [USER-SESSION] Fazendo logout');
        this.currentSecretCode = null;
        this.stopStatusPolling();
        this.clearSessionInfo();
        this.clearMessages();
        document.getElementById('secretCode').value = '';
        this.showLoginScreen();
    }

    showLoginScreen() {
        document.getElementById('loginScreen').classList.add('active');
        document.getElementById('sessionPanel').classList.remove('active');
    }

    showSessionPanel() {
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('sessionPanel').classList.add('active');
    }

    openModal() {
        document.getElementById('qrModal').style.display = 'flex';
    }

    closeModal() {
        document.getElementById('qrModal').style.display = 'none';
    }

    clearMessages() {
        document.getElementById('sessionError').textContent = '';
        document.getElementById('sessionSuccess').textContent = '';
    }

    showError(message) {
        document.getElementById('sessionError').textContent = message;
        document.getElementById('sessionSuccess').textContent = '';
    }

    showSuccess(message) {
        document.getElementById('sessionSuccess').textContent = message;
        document.getElementById('sessionError').textContent = '';
    }

    clearSessionInfo() {
        document.getElementById('displaySecretCode').textContent = '';
        document.getElementById('sessionStatus').textContent = '';
        document.getElementById('sessionStatus').className = 'status-badge';
        document.getElementById('lastUpdated').textContent = '';
        document.getElementById('connectBtn').disabled = true;
        document.getElementById('disconnectBtn').disabled = true;
    }

    updateSessionInfo(sessionData) {
        console.log('📊 [USER-SESSION] Atualizando informações da sessão:', sessionData);
        
        document.getElementById('displaySecretCode').textContent = sessionData.secret_code;
        
        const statusBadge = document.getElementById('sessionStatus');
        statusBadge.textContent = this.getStatusText(sessionData.status);
        statusBadge.className = `status-badge status-${sessionData.status}`;
        
        document.getElementById('lastUpdated').textContent = new Date(sessionData.updated_at).toLocaleString('pt-BR');

        // Atualizar botões baseado no status
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');

        if (sessionData.status === 'connected') {
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            connectBtn.textContent = '✅ Conectado';
        } else if (sessionData.status === 'connecting') {
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            connectBtn.textContent = '⏳ Conectando...';
        } else {
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
            connectBtn.textContent = '🔗 Conectar / Gerar QR';
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

    async loadSessionStatus() {
        if (!this.currentSecretCode) {
            this.showError('Código secreto não definido.');
            return;
        }

        console.log('🔄 [USER-SESSION] Carregando status da sessão...');
        this.showSuccess('Carregando informações da sessão...');

        try {
            const response = await fetch(`/qr/status/${this.currentSecretCode}`);
            const data = await response.json();

            console.log('📡 [USER-SESSION] Resposta do status:', data);

            if (data.success) {
                this.updateSessionInfo(data.data);
                this.showSuccess('Informações carregadas com sucesso.');
                this.startStatusPolling();
            } else {
                this.showError(data.error || 'Erro ao carregar informações da sessão.');
                if (data.code === 'NOT_FOUND') {
                    setTimeout(() => {
                        this.handleLogout();
                        document.getElementById('loginError').textContent = 'Código secreto não encontrado.';
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('❌ [USER-SESSION] Erro ao carregar status:', error);
            this.showError('Erro de conexão ao carregar informações.');
        }
    }

    startStatusPolling() {
        this.stopStatusPolling();
        console.log('🔄 [USER-SESSION] Iniciando polling de status');
        
        this.statusPollingInterval = setInterval(() => {
            this.checkConnectionStatus();
        }, 3000);
    }

    stopStatusPolling() {
        if (this.statusPollingInterval) {
            console.log('⏹️ [USER-SESSION] Parando polling de status');
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
                this.updateSessionInfo(data.data);
                
                // Se estava conectando e agora está conectado, fechar modal e mostrar sucesso
                if (document.getElementById('qrModal').style.display === 'flex' && data.data.status === 'connected') {
                    this.closeModal();
                    this.showSuccess('WhatsApp conectado com sucesso! 🎉');
                }
            } else {
                console.error('❌ [USER-SESSION] Erro no polling:', data.error);
            }
        } catch (error) {
            console.error('❌ [USER-SESSION] Erro de rede no polling:', error);
        }
    }

    async handleConnect() {
        if (!this.currentSecretCode) {
            this.showError('Código secreto não definido.');
            return;
        }

        console.log('🔗 [USER-SESSION] Iniciando conexão...');
        this.openModal();
        this.showModalLoading('Iniciando conexão...');

        try {
            const response = await fetch(`/qr/connect/${this.currentSecretCode}`);
            const data = await response.json();

            console.log('📡 [USER-SESSION] Resposta da conexão:', data);

            if (data.success) {
                if (data.status === 'connected') {
                    this.showModalConnected();
                    this.showSuccess('WhatsApp já está conectado!');
                    setTimeout(() => this.closeModal(), 2000);
                } else if (data.status === 'connecting' && data.data.qr_image) {
                    this.showModalQR(data.data.qr_image);
                    this.showSuccess('QR Code gerado. Escaneie para conectar.');
                    this.startStatusPolling();
                } else {
                    this.showModalLoading('Aguardando QR Code...');
                    this.startStatusPolling();
                }
            } else {
                this.showModalError(data.error || 'Erro ao gerar QR Code');
                this.showError(data.error || 'Erro ao conectar.');
                
                if (data.code === 'NOT_FOUND') {
                    setTimeout(() => {
                        this.closeModal();
                        this.handleLogout();
                        document.getElementById('loginError').textContent = 'Código secreto não encontrado.';
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('❌ [USER-SESSION] Erro ao conectar:', error);
            this.showModalError('Erro de conexão com o servidor');
            this.showError('Erro de conexão ao tentar conectar.');
        }
    }

    async handleDisconnect() {
        if (!this.currentSecretCode) {
            this.showError('Código secreto não definido.');
            return;
        }

        if (!confirm('Tem certeza que deseja desconectar esta instância? Isso encerrará a sessão do WhatsApp.')) {
            return;
        }

        console.log('🔌 [USER-SESSION] Desconectando...');
        this.showSuccess('Desconectando...');
        
        const disconnectBtn = document.getElementById('disconnectBtn');
        disconnectBtn.disabled = true;
        disconnectBtn.textContent = '⏳ Desconectando...';

        try {
            const response = await fetch(`/qr/disconnect/${this.currentSecretCode}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();

            console.log('📡 [USER-SESSION] Resposta da desconexão:', data);

            if (data.success) {
                this.showSuccess('Instância desconectada com sucesso! 🎉');
                this.updateSessionInfo({
                    secret_code: this.currentSecretCode,
                    status: 'logged_out',
                    updated_at: new Date().toISOString()
                });
                this.stopStatusPolling();
            } else {
                this.showError(`Erro ao desconectar: ${data.error || 'Erro desconhecido'}`);
                this.loadSessionStatus(); // Recarregar status
            }
        } catch (error) {
            console.error('❌ [USER-SESSION] Erro ao desconectar:', error);
            this.showError('Erro de conexão ao desconectar.');
            this.loadSessionStatus(); // Recarregar status
        }
    }

    showModalLoading(message) {
        const modalBody = document.getElementById('qrModalBody');
        modalBody.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
    }

    showModalQR(qrImage) {
        const modalBody = document.getElementById('qrModalBody');
        modalBody.innerHTML = `
            <img src="${qrImage}" alt="QR Code" class="qr-image">
        `;
    }

    showModalConnected() {
        const modalBody = document.getElementById('qrModalBody');
        modalBody.innerHTML = `
            <div class="status-message status-connected">
                ✅ WhatsApp já está conectado!
            </div>
        `;
    }

    showModalError(message) {
        const modalBody = document.getElementById('qrModalBody');
        modalBody.innerHTML = `
            <div class="status-message status-error">
                ❌ ${message}
            </div>
        `;
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 [USER-SESSION] DOM carregado, inicializando sistema');
    window.userSessionManager = new UserSessionManager();
});