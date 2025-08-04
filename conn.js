const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const { updateConnectionStatus } = require("./utils/fileStorage");
const path = require("path");

const startSock = async (secretCode, authFolderPath, activeConnections) => {
  const { state, saveCreds } = await useMultiFileAuthState(authFolderPath);
  const { version } = await fetchLatestBaileysVersion();

  let qrCode = null;
  let qrResolve = null;
  const qrPromise = new Promise((resolve) => {
    qrResolve = resolve;
  });

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("qr", (qr) => {
    console.log(`📱 QR Code gerado para ${secretCode}`);
    qrCode = qr;
    updateConnectionStatus(secretCode, 'connecting');
    if (qrResolve) {
      qrResolve(qr);
    }
  });

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      
      if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
        console.log(`❌ ${secretCode} foi desconectado (logged out)`);
        updateConnectionStatus(secretCode, 'logged_out');
        delete activeConnections[secretCode];
      } else {
        console.log(`🔄 ${secretCode} desconectado, tentando reconectar...`);
        updateConnectionStatus(secretCode, 'disconnected');
        delete activeConnections[secretCode];
        
        if (shouldReconnect) {
          setTimeout(() => {
            startSock(secretCode, authFolderPath, activeConnections);
          }, 5000);
        }
      }
    } else if (connection === "open") {
      console.log(`✅ ${secretCode} conectado ao WhatsApp!`);
      updateConnectionStatus(secretCode, 'connected');
      activeConnections[secretCode] = sock;
    }
  });

  return {
    sock,
    getQR: () => qrPromise,
    getCurrentQR: () => qrCode
  };
};

module.exports = startSock;
