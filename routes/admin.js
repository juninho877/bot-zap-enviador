const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { readConnections, addConnection, updateConnectionStatus, findConnection, removeConnection } = require("../utils/fileStorage");
const fs = require("fs");
const path = require("path");

const router = express.Router();

module.exports = (activeConnections) => {
  
  // Criar nova instância
  router.post("/create-instance", async (req, res) => {
    try {
      const secretCode = uuidv4();
      const authFolderPath = path.join("auth", secretCode);
      
      // Verifica se já existe uma conexão com este código (muito improvável com UUID)
      const existingConnection = findConnection(secretCode);
      if (existingConnection) {
        return res.status(400).json({
          success: false,
          error: "Código já existe. Tente novamente."
        });
      }
      
      // Cria a pasta de autenticação se não existir
      if (!fs.existsSync(authFolderPath)) {
        fs.mkdirSync(authFolderPath, { recursive: true });
      }
      
      // Adiciona a nova conexão ao arquivo JSON
      const newConnection = {
        id: uuidv4(),
        secret_code: secretCode,
        auth_folder_path: authFolderPath,
        status: 'disconnected'
      };
      
      addConnection(newConnection);
      
      res.json({
        success: true,
        message: "Nova instância criada com sucesso.",
        data: {
          secret_code: secretCode,
          status: 'disconnected'
        }
      });
      
    } catch (error) {
      console.error("Erro ao criar instância:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno ao criar instância."
      });
    }
  });
  
  // Desconectar instância
  router.post("/disconnect-instance", async (req, res) => {
    const { secret_code } = req.body;
    
    if (!secret_code) {
      return res.status(400).json({
        success: false,
        error: "Campo obrigatório: secret_code."
      });
    }
    
    try {
      // Verifica se a conexão existe
      const connection = findConnection(secret_code);
      if (!connection) {
        return res.status(404).json({
          success: false,
          error: "Instância não encontrada."
        });
      }
      
      // Se a instância estiver ativa, desconecta
      if (activeConnections[secret_code]) {
        try {
          await activeConnections[secret_code].logout();
        } catch (logoutError) {
          console.log("Erro ao fazer logout, forçando desconexão:", logoutError.message);
          activeConnections[secret_code].end();
        }
        delete activeConnections[secret_code];
      }
      
      // Atualiza o status no arquivo JSON
      updateConnectionStatus(secret_code, 'logged_out');
      
      // Remove os arquivos de autenticação
      const authFolderPath = connection.auth_folder_path;
      if (fs.existsSync(authFolderPath)) {
        fs.rmSync(authFolderPath, { recursive: true, force: true });
      }
      
      res.json({
        success: true,
        message: "Instância desconectada com sucesso."
      });
      
    } catch (error) {
      console.error("Erro ao desconectar instância:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno ao desconectar instância."
      });
    }
  });
  
  // Listar todas as instâncias
  router.get("/instances", (req, res) => {
    try {
      const connections = readConnections();
      const instancesWithStatus = connections.map(conn => ({
        secret_code: conn.secret_code,
        status: conn.status,
        created_at: conn.created_at,
        updated_at: conn.updated_at,
        is_active: !!activeConnections[conn.secret_code]
      }));
      
      res.json({
        success: true,
        data: instancesWithStatus
      });
      
    } catch (error) {
      console.error("Erro ao listar instâncias:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno ao listar instâncias."
      });
    }
  });
  
  return router;
};