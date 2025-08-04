class AdminPanel {
    constructor() {
        this.isAuthenticated = false;
        this.authToken = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthStatus();
    }

    bindEvents() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Create instance button
        document.getElementById('createInstanceBtn').addEventListener('click', () => {
            this.createInstance();
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadInstances();
        });
    }

    checkAuthStatus() {
        const savedAuth = localStorage.getItem('adminAuth');
        if (savedAuth) {
            this.authToken = savedAuth;
            this.isAuthenticated = true;
            this.showAdminPanel();
            this.loadInstances();
        } else {
            this.showLoginScreen();
        }
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');

        try {
            const credentials = btoa(`${username}:${password}`);
            const response = await fetch('/admin/instances', {
                headers: {
                    'Authorization': `Basic ${credentials}`
                }
            });

            if (response.ok) {
                this.authToken = credentials;
                this.isAuthenticated = true;
                localStorage.setItem('adminAuth', credentials);
                this.showAdminPanel();
                this.loadInstances();
                errorDiv.textContent = '';
            } else {
                const data = await response.json();
                errorDiv.textContent = data.error || 'Credenciais inválidas';
            }
        } catch (error) {
            errorDiv.textContent = 'Erro ao conectar com o servidor';
            console.error('Login error:', error);
        }
    }

    handleLogout() {
        this.isAuthenticated = false;
        this.authToken = null;
        localStorage.removeItem('adminAuth');
        this.showLoginScreen();
    }

    showLoginScreen() {
        document.getElementById('loginScreen').classList.add('active');
        document.getElementById('adminPanel').classList.remove('active');
    }

    showAdminPanel() {
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('adminPanel').classList.add('active');
    }

    async makeAuthenticatedRequest(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${this.authToken}`,
            ...options.headers
        };

        return fetch(url, {
            ...options,
            headers
        });
    }

    async loadInstances() {
        try {
            const response = await this.makeAuthenticatedRequest('/admin/instances');
            
            if (response.ok) {
                const data = await response.json();
                this.renderInstances(data.data);
            } else if (response.status === 401) {
                this.handleLogout();
            } else {
                console.error('Erro ao carregar instâncias');
            }
        } catch (error) {
            console.error('Erro ao carregar instâncias:', error);
        }
    }

    renderInstances(instances) {
        const container = document.getElementById('instancesList');
        
        if (instances.length === 0) {
            container.innerHTML = '<div class="loading">Nenhuma instância encontrada</div>';
            return;
        }

        container.innerHTML = instances.map(instance => `
            <div class="instance-card">
                <div class="instance-header">
                    <div class="instance-code">${instance.secret_code}</div>
                    <div class="status-badge status-${instance.status}">
                        ${this.getStatusText(instance.status)}
                    </div>
                </div>
                <div class="instance-info">
                    <p><strong>Criado em:</strong> ${new Date(instance.created_at).toLocaleString('pt-BR')}</p>
                    <p><strong>Atualizado em:</strong> ${new Date(instance.updated_at).toLocaleString('pt-BR')}</p>
                    <p><strong>Ativo:</strong> ${instance.is_active ? 'Sim' : 'Não'}</p>
                </div>
                <div class="instance-actions">
                    <a href="/qr-page" target="_blank" class="btn btn-info">📱 Abrir QR</a>
                    <button onclick="adminPanel.disconnectInstance('${instance.secret_code}')" 
                            class="btn btn-danger" 
                            ${instance.status === 'disconnected' ? 'disabled' : ''}>
                        🔌 Desconectar
                    </button>
                </div>
            </div>
        `).join('');
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

    async createInstance() {
        const button = document.getElementById('createInstanceBtn');
        const originalText = button.textContent;
        
        try {
            button.disabled = true;
            button.textContent = '⏳ Criando...';

            const response = await this.makeAuthenticatedRequest('/admin/create-instance', {
                method: 'POST'
            });

            if (response.ok) {
                const data = await response.json();
                alert(`✅ Nova instância criada!\n\nCódigo Secreto: ${data.data.secret_code}\n\nGuarde este código para conectar o WhatsApp.`);
                this.loadInstances();
            } else {
                const data = await response.json();
                alert(`❌ Erro: ${data.error}`);
            }
        } catch (error) {
            alert('❌ Erro ao criar instância');
            console.error('Create instance error:', error);
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    async disconnectInstance(secretCode) {
        if (!confirm('Tem certeza que deseja desconectar esta instância?')) {
            return;
        }

        try {
            const response = await this.makeAuthenticatedRequest('/admin/disconnect-instance', {
                method: 'POST',
                body: JSON.stringify({ secret_code: secretCode })
            });

            if (response.ok) {
                alert('✅ Instância desconectada com sucesso!');
                this.loadInstances();
            } else {
                const data = await response.json();
                alert(`❌ Erro: ${data.error}`);
            }
        } catch (error) {
            alert('❌ Erro ao desconectar instância');
            console.error('Disconnect instance error:', error);
        }
    }
}

// Inicializar o painel quando a página carregar
const adminPanel = new AdminPanel();