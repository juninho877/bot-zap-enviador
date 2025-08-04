const { findConnection } = require("../utils/fileStorage");

// Credenciais do admin (em produção, use variáveis de ambiente)
const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "admin123"
};

/**
 * Middleware de autenticação para o painel admin
 */
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({
      success: false,
      error: "Autenticação necessária"
    });
  }
  
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    next();
  } else {
    res.status(401).json({
      success: false,
      error: "Credenciais inválidas"
    });
  }
}

/**
 * Middleware de validação de secret code
 */
function validateSecretCode(req, res, next) {
  const secretCode = req.params.secretCode || req.body.secret_code;
  
  if (!secretCode) {
    return res.status(400).json({
      success: false,
      error: "Secret code é obrigatório"
    });
  }
  
  const connection = findConnection(secretCode);
  if (!connection) {
    return res.status(404).json({
      success: false,
      error: "Secret code não encontrado"
    });
  }
  
  req.connection = connection;
  next();
}

module.exports = {
  authenticateAdmin,
  validateSecretCode
};