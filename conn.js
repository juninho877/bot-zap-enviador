const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const { updateConnectionStatus } = require("./utils/fileStorage");
const fs = require("fs");
const path = require("path");

async function startSock(secretCode, authFolderPath, activeConnections) {
  console.log(`\n🔄 [CONN] === INICIANDO CONEXÃO ===`);
  console.log(`📱 [CONN] Secret Code: ${secretCode}`);
  console.log(`📁 [CONN] Auth Folder: ${authFolderPath}`);

  try {
    // Limpar pasta de autenticação se existir para forçar novo QR
    if (fs.existsSync(authFolderPath)) {
      console.log(`🧹 [CONN] Limpando pasta de auth existente: ${authFolderPath}`);
      fs.rmSync(authFolderPath, { recursive: true, force: true });
    }
    
    // Criar pasta de autenticação
    if (!fs.existsSync(authFolderPath)) {
      fs.mkdirSync(authFolderPath, { recursive: true });
      console.log(`📁 [CONN] Pasta de auth criada: ${authFolderPath}`);
    }

    const { state, saveCreds } = await useMultiFileAuthState(authFolderPath);
    console.log(`🔑 [CONN] Estado de autenticação carregado`);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ["Chrome", "Windows", "10"],
    });

    // Variáveis para controle do QR
    let qrResolve = null;
    let qrReject = null;
    let currentQR = null;
    let isConnected = false;

    // Função para obter QR Code (Promise)
    const getQR = () => {
      console.log(`⏳ [CONN] Criando promessa para aguardar QR Code...`);
      return new Promise((resolve, reject) => {
        qrResolve = resolve;
        qrReject = reject;
        
        // Timeout de 30 segundos para gerar QR
        setTimeout(() => {
          if (!isConnected && !currentQR) {
            console.log(`⏰ [CONN] Timeout: QR Code não foi gerado em 30 segundos`);
            reject(new Error("Timeout: QR Code não foi gerado"));
          }
        }, 30000);
      });
    };

    // Função para obter QR atual
    const getCurrentQR = () => {
      console.log(`🔍 [CONN] getCurrentQR chamado - QR atual: ${currentQR ? 'EXISTE' : 'NULL'}`);
      return currentQR;
    };

    // Event listener para QR Code
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      console.log(`\n📡 [CONN] === CONNECTION UPDATE ===`);
      console.log(`📱 [CONN] Secret Code: ${secretCode}`);
      console.log(`🔗 [CONN] Connection: ${connection}`);
      console.log(`📱 [CONN] QR presente: ${qr ? 'SIM' : 'NÃO'}`);

      // QR Code recebido
      if (qr) {
        console.log(`📱 [CONN] QR Code gerado para ${secretCode}:`);
        console.log(`📱 [CONN] QR: ${qr.substring(0, 50)}...`);
        
        currentQR = qr;
        updateConnectionStatus(secretCode, "connecting");
        
        if (qrResolve) {
          console.log(`✅ [CONN] Resolvendo promessa do QR Code`);
          qrResolve(qr);
          qrResolve = null;
          qrReject = null;
        }
      }

      // Conexão estabelecida
      if (connection === "open") {
        console.log(`✅ [CONN] WhatsApp conectado para ${secretCode}`);
        isConnected = true;
        currentQR = null;
        updateConnectionStatus(secretCode, "connected");
        
        if (qrReject) {
          qrReject = null;
          qrResolve = null;
        }
      }

      // Conexão fechada
      if (connection === "close") {
        console.log(`❌ [CONN] Conexão fechada para ${secretCode}`);
        isConnected = false;
        currentQR = null;
        
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          console.log(`🔄 [CONN] Tentando reconectar ${secretCode}...`);
          updateConnectionStatus(secretCode, "connecting");
          setTimeout(() => startSock(secretCode, authFolderPath, activeConnections), 3000);
        } else {
          console.log(`🚪 [CONN] Logout detectado para ${secretCode}`);
          updateConnectionStatus(secretCode, "logged_out");
          
          // Limpar pasta de auth após logout
          if (fs.existsSync(authFolderPath)) {
            fs.rmSync(authFolderPath, { recursive: true, force: true });
            console.log(`🧹 [CONN] Pasta de auth limpa após logout: ${authFolderPath}`);
          }
        }
        
        // Limpar da lista de conexões ativas
        if (activeConnections[secretCode]) {
          delete activeConnections[secretCode];
          console.log(`🗑️ [CONN] Removido das conexões ativas: ${secretCode}`);
        }
        
        // Rejeitar promessa do QR se ainda estiver pendente
        if (qrReject) {
          console.log(`❌ [CONN] Rejeitando promessa do QR devido ao fechamento da conexão`);
          qrReject(new Error("Conexão fechada antes do QR ser escaneado"));
          qrReject = null;
          qrResolve = null;
        }
      }
    });

    // Event listener para salvar credenciais
    sock.ev.on("creds.update", saveCreds);

    // Adicionar à lista de conexões ativas
    activeConnections[secretCode] = sock;
    
    // Adicionar métodos customizados ao socket
    sock.getQR = getQR;
    sock.getCurrentQR = getCurrentQR;
    
    console.log(`✅ [CONN] Socket criado e adicionado às conexões ativas: ${secretCode}`);
    console.log(`📊 [CONN] Total de conexões ativas: ${Object.keys(activeConnections).length}`);

    return sock;

  } catch (error) {
    console.error(`❌ [CONN] Erro ao iniciar socket para ${secretCode}:`, error.message);
    updateConnectionStatus(secretCode, "disconnected");
    
    // Limpar da lista de conexões ativas em caso de erro
    if (activeConnections[secretCode]) {
      delete activeConnections[secretCode];
    }
    
    throw error;
  }
}

module.exports = startSock;