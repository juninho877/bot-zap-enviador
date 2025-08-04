const fs = require('fs');
const path = require('path');

const CONNECTIONS_FILE = path.join(__dirname, '..', 'connections.json');

/**
 * Lê as conexões do arquivo JSON
 * @returns {Array} Array de conexões
 */
function readConnections() {
  try {
    if (!fs.existsSync(CONNECTIONS_FILE)) {
      // Se o arquivo não existe, cria um array vazio
      writeConnections([]);
      return [];
    }
    
    const data = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler connections.json:', error);
    return [];
  }
}

/**
 * Escreve as conexões no arquivo JSON
 * @param {Array} connections Array de conexões
 */
function writeConnections(connections) {
  try {
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(connections, null, 2));
  } catch (error) {
    console.error('Erro ao escrever connections.json:', error);
  }
}

/**
 * Encontra uma conexão pelo secret_code
 * @param {string} secretCode 
 * @returns {Object|null} Conexão encontrada ou null
 */
function findConnection(secretCode) {
  const connections = readConnections();
  return connections.find(conn => conn.secret_code === secretCode) || null;
}

/**
 * Atualiza o status de uma conexão
 * @param {string} secretCode 
 * @param {string} status 
 */
function updateConnectionStatus(secretCode, status) {
  const connections = readConnections();
  const connectionIndex = connections.findIndex(conn => conn.secret_code === secretCode);
  
  if (connectionIndex !== -1) {
    connections[connectionIndex].status = status;
    connections[connectionIndex].updated_at = new Date().toISOString();
    writeConnections(connections);
  }
}

/**
 * Adiciona uma nova conexão
 * @param {Object} connection 
 */
function addConnection(connection) {
  const connections = readConnections();
  connections.push({
    ...connection,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  writeConnections(connections);
}

/**
 * Remove uma conexão
 * @param {string} secretCode 
 */
function removeConnection(secretCode) {
  const connections = readConnections();
  const filteredConnections = connections.filter(conn => conn.secret_code !== secretCode);
  writeConnections(filteredConnections);
}

module.exports = {
  readConnections,
  writeConnections,
  findConnection,
  updateConnectionStatus,
  addConnection,
  removeConnection
};