const express = require("express");
const startSock = require("./conn");
const sendRoute = require("./routes/send");
const adminRoute = require("./routes/admin");
const qrRoute = require("./routes/qr");
const { readConnections } = require("./utils/fileStorage");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3334;
const activeConnections = {};

app.use(express.json());

// Função para inicializar conexões existentes
async function initializeExistingConnections() {
  const connections = readConnections();
  console.log(`📋 Encontradas ${connections.length} conexões salvas`);
  
  for (const connection of connections) {
    if (connection.status === 'connected' || connection.status === 'connecting') {
      try {
        console.log(`🔄 Tentando reconectar ${connection.secret_code}...`);
        
        // Verifica se a pasta de auth existe
        if (!fs.existsSync(connection.auth_folder_path)) {
          console.log(`❌ Pasta de auth não encontrada para ${connection.secret_code}`);
          continue;
        }
        
        await startSock(connection.secret_code, connection.auth_folder_path, activeConnections);
      } catch (error) {
        console.error(`❌ Erro ao reconectar ${connection.secret_code}:`, error.message);
      }
    }
  }
}

// Configurar rotas
app.use("/", sendRoute(activeConnections));
app.use("/admin", adminRoute(activeConnections));
app.use("/qr", qrRoute(activeConnections));

// Rota de status
app.get("/status", (req, res) => {
  const connections = readConnections();
  const activeCount = Object.keys(activeConnections).length;
  
  res.json({
    success: true,
    message: "API WhatsApp Multi-Conexão",
    data: {
      total_connections: connections.length,
      active_connections: activeCount,
      connections: connections.map(conn => ({
        secret_code: conn.secret_code,
        status: conn.status,
        is_active: !!activeConnections[conn.secret_code]
      }))
    }
  });
});

// Inicializar servidor
async function startServer() {
  try {
    // Criar pasta auth se não existir
    if (!fs.existsSync("auth")) {
      fs.mkdirSync("auth", { recursive: true });
    }
    
    // Inicializar conexões existentes
    await initializeExistingConnections();
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`📡 API WhatsApp Multi-Conexão rodando em http://localhost:${PORT}`);
      console.log(`📊 Status: http://localhost:${PORT}/status`);
      console.log(`🔧 Admin: http://localhost:${PORT}/admin/*`);
      console.log(`📱 QR: http://localhost:${PORT}/qr/:secretCode`);
    });
  } catch (error) {
    console.error("❌ Erro ao iniciar servidor:", error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor...');
  
  // Desconectar todas as instâncias ativas
  Object.keys(activeConnections).forEach(secretCode => {
    try {
      activeConnections[secretCode].end();
    } catch (error) {
      console.error(`Erro ao desconectar ${secretCode}:`, error.message);
    }
  });
  
  process.exit(0);
});

  app.listen(PORT, () => {
    console.log(`📡 API rodando em http://localhost:${PORT}`);
  });
});
