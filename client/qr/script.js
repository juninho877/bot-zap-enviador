class QRManager {
    constructor() {
        this.currentSecretCode = null;
        this.statusCheckInterval = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkUrlParams();
    }

    bindEvents() {
        // Code form
        document.getElementById('codeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCodeSubmit();
        });

        // Back button
        document.getElementById('backBtn').addEventListener('click', () => {
            this.showCodeScreen();
            this.clearMessages();
        });

        // Refresh QR button
        document.getElementById('refreshQrBtn').addEventListener('click', () => {
            this.refreshQRCode();
        });

        // Disconnect button
        document.getElementById('disconnectBtn').addEventListener('click', () => {
            this.disconnectInstance();
        });
    }

    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const secretCode = urlParams.get('code');
        
        if (secretCode) {
            document.getElementById('secretCode').value = secretCode;
            this.handleCodeSubmit();
        }
    }

    handleCodeSubmit() {
        const secretCode = document.getElementById('secretCode').value.trim();
        const errorDiv = document.getElementById('codeError');

        if (!secretCode) {
            errorDiv.textContent = 'Por favor, digite o código secreto';
            return;
        }

        this.currentSecretCode = secretCode;
        this.showQRScreen();
        this.loadQRCode();
    }

    async loadQRCode() {
        const qrContent = document.getElementById('qrContent');
        const errorDiv = document.getElementById('qrError');
        const successDiv = document.getElementById('qrSuccess');
        
        this.clearMessages();
        
        // Mostrar loading
        qrContent.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Carregando QR Code...</p>
            </div>
        `;

        try {
            console.log(`🔍 Carregando QR para código: ${this.currentSecretCode}`);
            
            const response = await fetch(`/qr/${this.currentSecretCode}`);
            const data = await response.json();

            console.log('📡 Resposta do servidor:', data);

            if (response.ok) {
                if (data.status === 'connected') {
                    this.showConnectedStatus();
                    successDiv.textContent = '✅ WhatsApp já está conectado!';
                } else if (data.qr_image) {
                    this.showQRCode(data.qr_image);
                    this.startStatusCheck();
                } else {
                    this.showError('QR Code não disponível no momento');
                }
            } else {
                if (response.status === 404) {
                    errorDiv.textContent = 'Código secreto não encontrado';
                    setTimeout(() => {
                        this.showCodeScreen();
                    }, 3000);
                } else {
                    this.showError(data.error || `Erro ${response.status}: ${response.statusText}`);
                }
            }

        } catch (error) {
            console.error('❌ Erro ao carregar QR:', error);
            this.showError('Erro ao conectar com o servidor');
        }
    }

    showQRCode(qrImage) {
        const qrContent = document.getElementById('qrContent');
        
        qrContent.innerHTML = `
            <div class="status-message status-connecting">
                🔄 Aguardando conexão do WhatsApp
            </div>
            <img src="${qrImage}" alt="QR Code" class="qr-image">
            <div class="qr-instructions">
                <strong>Como conectar:</strong><br>
                1. Abra o WhatsApp no seu celular<br>
                2. Toque em "Mais opções" ou "Menu" (⋮)<br>
                3. Toque em "Aparelhos conectados"<br>
                4. Toque em "Conectar um aparelho"<br>
                5. Aponte a câmera para este código QR
            </div>
        `;
    }

    showConnectedStatus() {
        const qrContent = document.getElementById('qrContent');
        
        qrContent.innerHTML = `
            <div class="status-message status-connected">
                ✅ WhatsApp conectado com sucesso!
            </div>
            <div class="qr-instructions">
                <strong>Código Secreto:</strong> <code>${this.currentSecretCode}</code><br><br>
                Seu WhatsApp está conectado e pronto para enviar mensagens.<br>
                Use este código secreto para enviar mensagens via API.
            </div>
        `;

        this.stopStatusCheck();
    }

    showDisconnectedStatus() {
        const qrContent = document.getElementById('qrContent');
        
        qrContent.innerHTML = `
            <div class="status-message status-disconnected">
                🔌 WhatsApp desconectado
            </div>
            <div class="qr-instructions">
                A instância foi desconectada.<br>
                Clique em "Atualizar QR" para gerar um novo código QR.
            </div>
        `;
    }

    showError(message) {
        const qrContent = document.getElementById('qrContent');
        
        qrContent.innerHTML = `
            <div class="status-message status-disconnected">
                ❌ ${message}
            </div>
            <div class="qr-instructions">
                Tente atualizar o QR Code ou verifique se o código secreto está correto.
            </div>
        `;
    }

    async refreshQRCode() {
        const refreshBtn = document.getElementById('refreshQrBtn');
        const originalText = refreshBtn.textContent;
        
        try {
            refreshBtn.disabled = true;
            refreshBtn.textContent = '⏳ Atualizando...';
            
            await this.loadQRCode();
            
        } catch (error) {
            console.error('❌ Erro ao atualizar QR:', error);
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.textContent = originalText;
        }
    }

    startStatusCheck() {
        this.stopStatusCheck();
        
        console.log('🔄 Iniciando verificação de status...');
        
        this.statusCheckInterval = setInterval(async () => {
            try {
                const response = await fetch(`/qr/${this.currentSecretCode}`);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('📊 Status check:', data.status);
                    
                    if (data.status === 'connected') {
                        this.showConnectedStatus();
                        document.getElementById('qrSuccess').textContent = '🎉 Conexão estabelecida com sucesso!';
                    }
                }
            } catch (error) {
                console.error('❌ Erro na verificação de status:', error);
            }
        }, 3000);
    }

    stopStatusCheck() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
            console.log('⏹️ Verificação de status parada');
        }
    }

    async disconnectInstance() {
        if (!confirm('Tem certeza que deseja desconectar esta instância?')) {
            return;
        }

        const errorDiv = document.getElementById('qrError');
        const successDiv = document.getElementById('qrSuccess');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const originalText = disconnectBtn.textContent;

        this.clearMessages();

        try {
            disconnectBtn.disabled = true;
            disconnectBtn.textContent = '⏳ Desconectando...';

            const response = await fetch('/admin/disconnect-instance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ secret_code: this.currentSecretCode })
            });

            const data = await response.json();

            if (response.ok) {
                successDiv.textContent = '✅ Instância desconectada com sucesso!';
                this.showDisconnectedStatus();
                this.stopStatusCheck();
            } else {
                errorDiv.textContent = data.error || 'Erro ao desconectar instância';
            }

        } catch (error) {
            console.error('❌ Erro ao desconectar:', error);
            errorDiv.textContent = 'Erro ao conectar com o servidor';
        } finally {
            disconnectBtn.disabled = false;
            disconnectBtn.textContent = originalText;
        }
    }

    showCodeScreen() {
        document.getElementById('codeScreen').classList.add('active');
        document.getElementById('qrScreen').classList.remove('active');
        this.stopStatusCheck();
        this.currentSecretCode = null;
    }

    showQRScreen() {
        document.getElementById('codeScreen').classList.remove('active');
        document.getElementById('qrScreen').classList.add('active');
    }

    clearMessages() {
        document.getElementById('codeError').textContent = '';
        document.getElementById('qrError').textContent = '';
        document.getElementById('qrSuccess').textContent = '';
    }
}

// Inicializar o gerenciador de QR quando a página carregar
const qrManager = new QRManager();

// Limpar interval quando a página for fechada
window.addEventListener('beforeunload', () => {
    qrManager.stopStatusCheck();
});