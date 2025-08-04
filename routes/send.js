const express = require("express");
const axios = require("axios");
const mime = require("mime-types");

const router = express.Router();

module.exports = (activeConnections) => {
  router.post("/send", async (req, res) => {
    const { secret_code, number, text, imageUrl } = req.body;

    if (!secret_code || !number || !text) {
      return res.status(400).json({
        success: false,
        error: "Campos obrigatórios: secret_code, number e text.",
      });
    }

    // Verifica se a instância está ativa
    const sock = activeConnections[secret_code];
    if (!sock) {
      return res.status(404).json({
        success: false,
        error: "Instância não encontrada ou não está conectada. Verifique o secret_code e se o WhatsApp está conectado."
      });
    }

    const jid = number.includes("@s.whatsapp.net") ? number : `${number}@s.whatsapp.net`;

    try {
      const isOnWhatsApp = await sock.onWhatsApp(jid);
      if (!isOnWhatsApp || !isOnWhatsApp[0]?.exists) {
        return res.status(404).json({ success: false, error: "Número não está no WhatsApp." });
      }

      if (imageUrl) {
        const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
        const buffer = Buffer.from(response.data, "binary");

        await sock.sendMessage(jid, {
          image: buffer,
          caption: text,
          mimetype: response.headers["content-type"] || mime.lookup(imageUrl),
        });
      } else {
        await sock.sendMessage(jid, { text });
      }

      res.json({ success: true, message: "Mensagem enviada com sucesso." });

    } catch (err) {
      console.error(`Erro ao enviar mensagem via ${secret_code}:`, err);
      res.status(500).json({ success: false, error: "Erro interno ao enviar mensagem." });
    }
  });

  return router;
};
