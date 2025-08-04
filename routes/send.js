const express = require("express");
const axios = require("axios");
const mime = require("mime-types");

const router = express.Router();

module.exports = (sock) => {
  router.post("/send", async (req, res) => {
    const { number, text, imageUrl } = req.body;

    if (!number || !text) {
      return res.status(400).json({
        success: false,
        error: "Campos obrigatórios: number e text.",
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
      console.error("Erro ao enviar mensagem:", err);
      res.status(500).json({ success: false, error: "Erro interno ao enviar." });
    }
  });

  return router;
};
