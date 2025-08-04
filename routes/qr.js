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
    
    console.log(`\n🔍 [QR] === NOVA SOLICITAÇÃO QR ===`);
    console.log(`🔍 [QR] Secret Code: ${secretCode}`);
    console.log(`🔍 [QR] Status da conexão: ${connection.status}`);
    console.log(`🔍 [QR] Conexão ativa: ${!!activeConnections[secretCode]}`);
    console.log(`🔍 [QR] Pasta auth: ${connection.auth_folder_path}`);
    
    try {
      // Se já estiver conectado
      if (connection.status === 'connected' && activeConnections[secretCode]) {
        console.log(`✅ [QR] Já conectado - retornando status`);
        return res.json({
          success: true,
          message: "WhatsApp já está conectado.",
          status: 'connected'
        });
      }
      
      // Se já estiver tentando conectar
      if (activeConnections[secretCode]) {
        console.log(`🔄 [QR] Conexão ativa encontrada, verificando QR`);
        const sockData = activeConnections[secretCode];
        if (sockData.getCurrentQR && sockData.getCurrentQR()) {
          console.log(`📱 [QR] QR atual disponível`);
          try {
            const qrImage = await QRCode.toDataURL(sockData.getCurrentQR());
            console.log(`✅ [QR] Imagem QR gerada`);
            return res.json({
              success: true,
              message: "QR Code disponível.",
              qr_code: sockData.getCurrentQR(),
              qr_image: qrImage,
              status: 'connecting'
            });
          } catch (qrError) {
            console.error(`❌ [QR] Erro ao gerar imagem QR:`, qrError.message);
          }
        } else {
          console.log(`⚠️ [QR] Conexão ativa mas sem QR disponível`);
        }
      }
      
      // Inicia nova conexão
      console.log(`🔄 [QR] Iniciando nova conexão...`);
      updateConnectionStatus(secretCode, 'connecting');
      
      const sockData = await startSock(secretCode, connection.auth_folder_path, activeConnections);
      console.log(`🔌 [QR] Socket iniciado`);
      
      // Aguarda o QR code ser gerado
      try {
        console.log(`⏳ [QR] Aguardando QR Code...`);
        const qrCode = await sockData.getQR();
        console.log(`📱 [QR] QR Code recebido`);
        const qrImage = await QRCode.toDataURL(qrCode);
        console.log(`✅ [QR] Imagem QR gerada com sucesso`);
        
        res.json({
          success: true,
          message: "QR Code gerado com sucesso. Escaneie com seu WhatsApp.",
          qr_code: qrCode,
          qr_image: qrImage,
          status: 'connecting'
        });
        
      } catch (qrError) {
        console.error(`❌ [QR] Erro ao obter QR code:`, qrError.message);
        console.error(`❌ [QR] Stack trace:`, qrError.stack);
        res.status(500).json({
          success: false,
          error: "Erro ao gerar QR code.",
          details: process.env.NODE_ENV === 'development' ? qrError.message : 'Erro interno'
        });
      }
      
    } catch (error) {
      console.error(`❌ [QR] Erro geral:`, error.message);
      console.error(`❌ [QR] Stack trace:`, error.stack);
      res.status(500).json({
        success: false,
        error: "Erro interno ao processar solicitação.",
        details: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno'
      });
    }
  });
  
  return router;
};