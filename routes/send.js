const express = require("express");
const axios = require("axios");
const mime = require("mime-types");

/**
 * Normaliza o número de telefone e gera candidatos para verificação
 * @param {string} inputNumber - Número fornecido na requisição
 * @returns {Array} Array com possíveis variações do número
 */
function normalizeAndGenerateCandidates(inputNumber) {
  console.log(`📞 [SEND] Normalizando número: ${inputNumber}`);
  
  // Remove todos os caracteres não numéricos
  let cleanNumber = inputNumber.replace(/\D/g, '');
  console.log(`🧹 [SEND] Número limpo: ${cleanNumber}`);
  
  // Remove zero inicial se presente
  if (cleanNumber.startsWith('0')) {
    cleanNumber = cleanNumber.substring(1);
    console.log(`🔄 [SEND] Removido zero inicial: ${cleanNumber}`);
  }
  
  // Adiciona código do país 55 se não estiver presente
  if (!cleanNumber.startsWith('55')) {
    cleanNumber = '55' + cleanNumber;
    console.log(`🇧🇷 [SEND] Adicionado código do país: ${cleanNumber}`);
  }
  
  // Valida se tem pelo menos 12 dígitos (55 + DDD + número)
  if (cleanNumber.length < 12) {
    throw new Error(`Número muito curto: ${cleanNumber}. Deve ter pelo menos 10 dígitos após o código do país.`);
  }
  
  if (cleanNumber.length > 13) {
    throw new Error(`Número muito longo: ${cleanNumber}. Deve ter no máximo 11 dígitos após o código do país.`);
  }
  
  const candidates = [];
  
  // Se o número tem 13 dígitos (55 + DDD + 9 + 8 dígitos)
  if (cleanNumber.length === 13) {
    const ddd = cleanNumber.substring(2, 4);
    const restNumber = cleanNumber.substring(4);
    
    // Verifica se o terceiro dígito após o DDD é 9
    if (restNumber.startsWith('9')) {
      // Adiciona versão com 9
      candidates.push(cleanNumber);
      // Adiciona versão sem 9
      candidates.push('55' + ddd + restNumber.substring(1));
    } else {
      // Se não começa com 9, apenas adiciona o número como está
      candidates.push(cleanNumber);
    }
  }
  // Se o número tem 12 dígitos (55 + DDD + 8 dígitos)
  else if (cleanNumber.length === 12) {
    const ddd = cleanNumber.substring(2, 4);
    const restNumber = cleanNumber.substring(4);
    
    // Adiciona versão sem 9
    candidates.push(cleanNumber);
    // Adiciona versão com 9
    candidates.push('55' + ddd + '9' + restNumber);
  }
  
  console.log(`📋 [SEND] Candidatos gerados:`, candidates);
  return candidates;
}

const router = express.Router();

module.exports = (activeConnections) => {
  router.post("/send", async (req, res) => {
    const { secret_code, number, text, imageUrl } = req.body;

    console.log(`\n📨 [SEND] === NOVA REQUISIÇÃO DE ENVIO ===`);
    console.log(`🔑 [SEND] Secret Code: ${secret_code}`);
    console.log(`📞 [SEND] Número original: ${number}`);
    console.log(`💬 [SEND] Texto: ${text?.substring(0, 50)}${text?.length > 50 ? '...' : ''}`);
    console.log(`🖼️ [SEND] Imagem: ${imageUrl ? 'SIM' : 'NÃO'}`);

    if (!secret_code || !number || !text) {
      console.log(`❌ [SEND] Campos obrigatórios faltando`);
      return res.status(400).json({
        success: false,
        error: "Campos obrigatórios: secret_code, number e text.",
      });
    }

    // Verifica se a instância está ativa
    const sock = activeConnections[secret_code];
    if (!sock) {
      console.log(`❌ [SEND] Instância não encontrada: ${secret_code}`);
      return res.status(404).json({
        success: false,
        error: "Instância não encontrada ou não está conectada. Verifique o secret_code e se o WhatsApp está conectado."
      });
    }

    try {
      // Normalizar e gerar candidatos
      const candidates = normalizeAndGenerateCandidates(number);
      
      console.log(`🔍 [SEND] Verificando candidatos no WhatsApp...`);
      
      // Verificar quais candidatos existem no WhatsApp
      const validCandidates = [];
      
      for (const candidate of candidates) {
        const jid = `${candidate}@s.whatsapp.net`;
        console.log(`🔍 [SEND] Verificando: ${candidate}`);
        
        try {
          const isOnWhatsApp = await sock.onWhatsApp(jid);
          if (isOnWhatsApp && isOnWhatsApp[0]?.exists) {
            console.log(`✅ [SEND] Número válido: ${candidate}`);
            validCandidates.push({
              number: candidate,
              jid: jid,
              length: candidate.length
            });
          } else {
            console.log(`❌ [SEND] Número não existe: ${candidate}`);
          }
        } catch (checkError) {
          console.error(`⚠️ [SEND] Erro ao verificar ${candidate}:`, checkError.message);
        }
      }
      
      if (validCandidates.length === 0) {
        console.log(`❌ [SEND] Nenhum número válido encontrado`);
        return res.status(404).json({
          success: false,
          error: "Número não está no WhatsApp. Verificamos as variações possíveis e nenhuma foi encontrada.",
          checked_numbers: candidates
        });
      }
      
      // Escolher o melhor candidato (priorizar o menor número se ambos existirem)
      const selectedCandidate = validCandidates.sort((a, b) => a.length - b.length)[0];
      console.log(`🎯 [SEND] Número selecionado: ${selectedCandidate.number}`);
      console.log(`📋 [SEND] Candidatos válidos encontrados: ${validCandidates.length}`);

      // Enviar mensagem
      console.log(`📤 [SEND] Enviando mensagem...`);

      if (imageUrl) {
        console.log(`🖼️ [SEND] Baixando imagem: ${imageUrl}`);
        const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
        const buffer = Buffer.from(response.data, "binary");

        await sock.sendMessage(selectedCandidate.jid, {
          image: buffer,
          caption: text,
          mimetype: response.headers["content-type"] || mime.lookup(imageUrl),
        });
        console.log(`✅ [SEND] Imagem enviada com sucesso`);
      } else {
        await sock.sendMessage(selectedCandidate.jid, { text });
        console.log(`✅ [SEND] Mensagem de texto enviada com sucesso`);
      }

      res.json({
        success: true,
        message: "Mensagem enviada com sucesso.",
        data: {
          sent_to: selectedCandidate.number,
          candidates_checked: candidates,
          valid_candidates: validCandidates.map(c => c.number)
        }
      });

    } catch (error) {
      console.error(`❌ [SEND] Erro ao processar envio:`, error.message);
      
      if (error.message.includes('muito curto') || error.message.includes('muito longo')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        error: "Erro interno ao enviar mensagem.",
        details: error.message
      });
    }
  });

  return router;
};
