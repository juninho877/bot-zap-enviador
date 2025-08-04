class QRManager {
    constructor() {
        this.currentSecretCode = null;
        this.qrCheckInterval = null;
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
        });

        // Refresh QR button
        document.getElementById('refreshQrBtn').addEventListener('click', () => {
            this.loadQRCode();
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

    async handleCodeSubmit() {
        const secretCode = document.getElementById('secretCode').value.trim();
        const errorDiv = document.getElementById('codeError');

        if (!secretCode) {
            errorDiv.textContent = 'Por favor, digite o código secreto';
            return;
        }

        this.currentSecretCode = secretCode;
        this.showQRScreen();
        this.loadQRCode();
        errorDiv.textContent = '';
    }

    showCodeScreen() {
        document.getElementById('codeScreen').classList.add('active');
        document.getElementById('qrScreen').classList.remove('active');
        this.stopQRCheck();
    }

    showQRScreen() {
        document.getElementById('codeScreen').classList.remove('active');
        document.getElementById('qrScreen').classList.add('active');
    }

    async loadQRCode() {
        const qrContent = document.getElementById('qrContent');
        const errorDiv = document.getElementById('qrError');
        const successDiv = document.getElementById('qrSuccess');

        // Limpar mensagens
        errorDiv.textContent = '';
        successDiv.textContent = '';

        // Mostrar loading
        qrContent.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Carregando QR Code...</p>
            </div>
        `;

        try {
            const response = await fetch(`/qr/${this.currentSecretCode}`);
            const data = await response.json();

            if (response.ok) {
                if (data.status === 'connected') {
                    this.showConnectedStatus();
                } else if (data.qr_image) {
                    this.showQRCode(data.qr_image);
                    this.startQRCheck();
                } else {
                    errorDiv.textContent = 'QR Code não disponível';
                }
            } else {
                if (response.status === 404) {
                    // Código secreto não encontrado, voltar para tela de código
                    errorDiv.textContent = 'Código secreto não encontrado';
                    setTimeout(() => {
                        this.showCodeScreen();
                    }, 2000);
                } else {
                    errorDiv.textContent = data.error || 'Erro ao carregar QR Code';
                }
            }

        } catch (error) {
            errorDiv.textContent = 'Erro ao conectar com o servidor';
            console.error('QR load error:', error);
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
                Seu WhatsApp está conectado e pronto para enviar mensagens.<br>
                Use o código secreto <strong>${this.currentSecretCode}</strong> para enviar mensagens via API.
            </div>
        `;

        this.stopQRCheck();
    }

    showDisconnectedStatus() {
        const qrContent = document.getElementById('qrContent');
        
        qrContent.innerHTML = `
            <div class="status-message status-disconnected">
                🔌 WhatsApp desconectado
            </div>
            <div class="qr-instructions">
                A instância foi desconectada. Clique em "Atualizar QR" para gerar um novo código QR.
            </div>
        `;
    }

    startQRCheck() {
        this.stopQRCheck();
        
        this.qrCheckInterval = setInterval(async () => {
            try {
                // Verificar status através do endpoint QR em vez de admin/instances
                const response = await fetch(`/qr/${this.currentSecretCode}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'connected') {
                        this.showConnectedStatus();
                    }
                }
            } catch (error) {
                console.error('Status check error:', error);
            }
        }, 3000); // Verificar a cada 3 segundos
    }

    stopQRCheck() {
        if (this.qrCheckInterval) {
            clearInterval(this.qrCheckInterval);
            this.qrCheckInterval = null;
        }
    }

    async disconnectInstance() {
        if (!confirm('Tem certeza que deseja desconectar esta instância?')) {
            return;
        }

        const errorDiv = document.getElementById('qrError');
        const successDiv = document.getElementById('qrSuccess');
        const disconnectBtn = document.getElementById('disconnectBtn');

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
                errorDiv.textContent = '';
            } else {
                errorDiv.textContent = data.error || 'Erro ao desconectar instância';
            }

        } catch (error) {
            errorDiv.textContent = 'Erro ao conectar com o servidor';
            console.error('Disconnect error:', error);
        } finally {
            disconnectBtn.disabled = false;
            disconnectBtn.textContent = '🔌 Desconectar';
        }
    }
}

// Inicializar o gerenciador de QR quando a página carregar
const qrManager = new QRManager();

// Limpar interval quando a página for fechada
window.addEventListener('beforeunload', () => {
    qrManager.stopQRCheck();
});