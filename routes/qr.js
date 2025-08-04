const express = require("express");
const { findConnection, updateConnectionStatus } = require("../utils/fileStorage");
const { validateSecretCode } = require("../middleware/auth");
const startSock = require("../conn");
const QRCode = require("qrcode");

const router = express.Router();

module.exports = (activeConnections) => {
  
  router.get("/:secretCode", validateSecretCode, async (req, res) => {
    const { secretCode } = req.params;
    const connection = req.connection; // Vem do middleware validateSecretCode
    
    console.log(`🔍 [QR] Solicitação recebida para secretCode: ${secretCode}`);
    console.log(`🔍 [QR] Connection encontrada:`, connection);
    console.log(`🔍 [QR] Status atual da conexão: ${connection.status}`);
    console.log(`🔍 [QR] Conexão ativa existe: ${!!activeConnections[secretCode]}`);
    
    try {
      // Se já estiver conectado
      if (connection.status === 'connected' && activeConnections[secretCode]) {
        console.log(`✅ [QR] ${secretCode} já está conectado`);
        return res.json({
          success: true,
          message: "WhatsApp já está conectado.",
          status: 'connected'
        });
      }
      
      // Se já estiver tentando conectar
      if (activeConnections[secretCode]) {
        console.log(`🔄 [QR] ${secretCode} já tem conexão ativa, verificando QR atual`);
        const sockData = activeConnections[secretCode];
        if (sockData.getCurrentQR && sockData.getCurrentQR()) {
          console.log(`📱 [QR] QR Code atual encontrado para ${secretCode}`);
          try {
            const qrImage = await QRCode.toDataURL(sockData.getCurrentQR());
            console.log(`✅ [QR] Imagem QR gerada com sucesso para ${secretCode}`);
            return res.json({
              success: true,
              message: "QR Code disponível.",
              qr_code: sockData.getCurrentQR(),
              qr_image: qrImage,
              status: 'connecting'
            });
          } catch (qrError) {
            console.error(`❌ [QR] Erro ao gerar imagem QR para ${secretCode}:`, qrError);
          }
        } else {
          console.log(`⚠️ [QR] ${secretCode} tem conexão ativa mas sem QR atual`);
        }
      }
      
      // Inicia nova conexão
      console.log(`🔄 [QR] Iniciando nova conexão para ${secretCode}...`);
      updateConnectionStatus(secretCode, 'connecting');
      
      const sockData = await startSock(secretCode, connection.auth_folder_path, activeConnections);
      console.log(`🔌 [QR] Socket iniciado para ${secretCode}`);
      
      // Aguarda o QR code ser gerado
      try {
        console.log(`⏳ [QR] Aguardando QR Code para ${secretCode}...`);
        const qrCode = await sockData.getQR();
        console.log(`📱 [QR] QR Code recebido para ${secretCode}`);
        const qrImage = await QRCode.toDataURL(qrCode);
        console.log(`✅ [QR] Imagem QR gerada com sucesso para ${secretCode}`);
        
        res.json({
          success: true,
          message: "QR Code gerado com sucesso. Escaneie com seu WhatsApp.",
          qr_code: qrCode,
          qr_image: qrImage,
          status: 'connecting'
        });
        
      } catch (qrError) {
        console.error(`❌ [QR] Erro ao obter QR code para ${secretCode}:`, qrError);
        console.error(`❌ [QR] Stack trace:`, qrError.stack);
        res.status(500).json({
          success: false,
          error: "Erro ao gerar QR code.",
          details: qrError.message
        });
      }
      
    } catch (error) {
      console.error(`❌ [QR] Erro geral ao processar QR para ${secretCode}:`, error);
      console.error(`❌ [QR] Stack trace:`, error.stack);
      console.error(`❌ [QR] Tipo do erro:`, error.constructor.name);
      res.status(500).json({
        success: false,
        error: "Erro interno ao processar solicitação.",
        details: error.message
      });
    }
  });
  
  return router;
};