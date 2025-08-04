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
    
    try {
      // Se já estiver conectado
      if (connection.status === 'connected' && activeConnections[secretCode]) {
        return res.json({
          success: true,
          message: "WhatsApp já está conectado.",
          status: 'connected'
        });
      }
      
      // Se já estiver tentando conectar
      if (activeConnections[secretCode]) {
        const sockData = activeConnections[secretCode];
        if (sockData.getCurrentQR && sockData.getCurrentQR()) {
          try {
            const qrImage = await QRCode.toDataURL(sockData.getCurrentQR());
            return res.json({
              success: true,
              message: "QR Code disponível.",
              qr_code: sockData.getCurrentQR(),
              qr_image: qrImage,
              status: 'connecting'
            });
          } catch (qrError) {
            console.error("Erro ao gerar imagem QR:", qrError);
          }
        }
      }
      
      // Inicia nova conexão
      console.log(`🔄 Iniciando conexão para ${secretCode}...`);
      updateConnectionStatus(secretCode, 'connecting');
      
      const sockData = await startSock(secretCode, connection.auth_folder_path, activeConnections);
      
      // Aguarda o QR code ser gerado
      try {
        const qrCode = await sockData.getQR();
        const qrImage = await QRCode.toDataURL(qrCode);
        
        res.json({
          success: true,
          message: "QR Code gerado com sucesso. Escaneie com seu WhatsApp.",
          qr_code: qrCode,
          qr_image: qrImage,
          status: 'connecting'
        });
        
      } catch (qrError) {
        console.error("Erro ao obter QR code:", qrError);
        res.status(500).json({
          success: false,
          error: "Erro ao gerar QR code."
        });
      }
      
    } catch (error) {
      console.error("Erro ao processar QR:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno ao processar solicitação."
      });
    }
  });
  
  return router;
};