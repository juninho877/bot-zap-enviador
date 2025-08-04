const express = require("express");
const { readConnections, updateConnectionStatus } = require("../utils/fileStorage");
const startSock = require("../conn");
const QRCode = require("qrcode");
const path = require("path");

const router = express.Router();

module.exports = (activeConnections) => {
  
  // Endpoint principal para obter QR Code
  router.get("/connect/:secretCode", async (req, res) => {
    const { secretCode } = req.params;
    
    console.log(`\n🔍 [QR-CONNECT] === NOVA SOLICITAÇÃO ===`);
    console.log(`📱 [QR-CONNECT] Secret Code: ${secretCode}`);
    
    try {
      // Buscar conexão no arquivo JSON
      const connections = readConnections();
      const connection = connections.find(conn => conn.secret_code === secretCode);
      
      if (!connection) {
        console.log(`❌ [QR-CONNECT] Código não encontrado: ${secretCode}`);
        return res.status(404).json({
          success: false,
          error: "Código secreto não encontrado",
          code: "NOT_FOUND"
        });
      }
      
      console.log(`✅ [QR-CONNECT] Conexão encontrada - Status: ${connection.status}`);
      
      // Se já estiver conectado
      if (connection.status === 'connected' && activeConnections[secretCode]) {
        console.log(`🟢 [QR-CONNECT] Já conectado`);
        return res.json({
          success: true,
          status: 'connected',
          message: "WhatsApp já está conectado",
          data: {
            secret_code: secretCode,
            connected_at: connection.updated_at
          }
        });
      }
      
      // Se já existe uma conexão ativa (conectando)
      if (activeConnections[secretCode]) {
        console.log(`🟡 [QR-CONNECT] Conexão ativa encontrada`);
        const sockData = activeConnections[secretCode];
        
        if (sockData.getCurrentQR && sockData.getCurrentQR()) {
          try {
            const qrImage = await QRCode.toDataURL(sockData.getCurrentQR());
            console.log(`📱 [QR-CONNECT] QR atual disponível`);
            
            return res.json({
              success: true,
              status: 'connecting',
              message: "QR Code disponível para escaneamento",
              data: {
                secret_code: secretCode,
                qr_code: sockData.getCurrentQR(),
                qr_image: qrImage
              }
            });
          } catch (qrError) {
            console.error(`❌ [QR-CONNECT] Erro ao gerar imagem QR:`, qrError.message);
          }
        }
      }
      
      // Iniciar nova conexão
      console.log(`🔄 [QR-CONNECT] Iniciando nova conexão...`);
      updateConnectionStatus(secretCode, 'connecting');
      
      const sockData = await startSock(secretCode, connection.auth_folder_path, activeConnections);
      
      // Aguardar QR Code
      try {
        console.log(`⏳ [QR-CONNECT] Aguardando QR Code...`);
        const qrCode = await sockData.getQR();
        const qrImage = await QRCode.toDataURL(qrCode);
        
        console.log(`✅ [QR-CONNECT] QR Code gerado com sucesso`);
        
        return res.json({
          success: true,
          status: 'connecting',
          message: "QR Code gerado. Escaneie com seu WhatsApp",
          data: {
            secret_code: secretCode,
            qr_code: qrCode,
            qr_image: qrImage
          }
        });
        
      } catch (qrError) {
        console.error(`❌ [QR-CONNECT] Erro ao obter QR:`, qrError.message);
        return res.status(500).json({
          success: false,
          error: "Erro ao gerar QR Code",
          code: "QR_GENERATION_ERROR",
          details: qrError.message
        });
      }
      
    } catch (error) {
      console.error(`❌ [QR-CONNECT] Erro geral:`, error.message);
      return res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
        code: "INTERNAL_ERROR",
        details: error.message
      });
    }
  });
  
  // Endpoint para verificar status da conexão
  router.get("/status/:secretCode", async (req, res) => {
    const { secretCode } = req.params;
    
    try {
      const connections = readConnections();
      const connection = connections.find(conn => conn.secret_code === secretCode);
      
      if (!connection) {
        return res.status(404).json({
          success: false,
          error: "Código não encontrado",
          code: "NOT_FOUND"
        });
      }
      
      const isActive = !!activeConnections[secretCode];
      
      return res.json({
        success: true,
        data: {
          secret_code: secretCode,
          status: connection.status,
          is_active: isActive,
          updated_at: connection.updated_at
        }
      });
      
    } catch (error) {
      console.error(`❌ [QR-STATUS] Erro:`, error.message);
      return res.status(500).json({
        success: false,
        error: "Erro interno",
        code: "INTERNAL_ERROR"
      });
    }
  });
  
  // Endpoint para desconectar instância
  router.post("/disconnect/:secretCode", async (req, res) => {
    const { secretCode } = req.params;
    
    console.log(`\n🔌 [QR-DISCONNECT] Desconectando: ${secretCode}`);
    
    try {
      const connections = readConnections();
      const connection = connections.find(conn => conn.secret_code === secretCode);
      
      if (!connection) {
        return res.status(404).json({
          success: false,
          error: "Código não encontrado",
          code: "NOT_FOUND"
        });
      }
      
      // Desconectar se estiver ativo
      if (activeConnections[secretCode]) {
        try {
          await activeConnections[secretCode].logout();
        } catch (logoutError) {
          console.log(`⚠️ [QR-DISCONNECT] Erro no logout, forçando desconexão`);
          activeConnections[secretCode].end();
        }
        delete activeConnections[secretCode];
      }
      
      // Atualizar status
      updateConnectionStatus(secretCode, 'logged_out');
      
      console.log(`✅ [QR-DISCONNECT] Desconectado com sucesso`);
      
      return res.json({
        success: true,
        message: "Instância desconectada com sucesso",
        data: {
          secret_code: secretCode,
          status: 'logged_out'
        }
      });
      
    } catch (error) {
      console.error(`❌ [QR-DISCONNECT] Erro:`, error.message);
      return res.status(500).json({
        success: false,
        error: "Erro ao desconectar",
        code: "DISCONNECT_ERROR"
      });
    }
  });
  
  return router;
};