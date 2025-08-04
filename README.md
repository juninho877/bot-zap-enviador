# WhatsApp Bot Multi-Conexão

Bot WhatsApp com suporte a múltiplas conexões simultâneas, usando Baileys + Express.

## Funcionalidades

- ✅ Múltiplas conexões WhatsApp simultâneas
- ✅ Painel administrativo para gerenciar instâncias
- ✅ QR Code para conectar WhatsApp
- ✅ Envio de mensagens de texto e imagens
- ✅ Persistência em arquivo JSON
- ✅ Reconexão automática

## Instalação

```bash
npm install
npm start
```

## Endpoints da API

### Status da API
```
GET /status
```

### Administração

#### Criar nova instância
```
POST /admin/create-instance
```

#### Desconectar instância
```
POST /admin/disconnect-instance
{
  "secret_code": "uuid-da-instancia"
}
```

#### Listar instâncias
```
GET /admin/instances
```

### QR Code

#### Obter QR Code para conectar
```
GET /qr/:secretCode
```

### Envio de Mensagens

#### Enviar mensagem de texto
```
POST /send
{
  "secret_code": "uuid-da-instancia",
  "number": "5511999999999",
  "text": "Sua mensagem aqui"
}
```

#### Enviar mensagem com imagem
```
POST /send
{
  "secret_code": "uuid-da-instancia",
  "number": "5511999999999",
  "text": "Legenda da imagem",
  "imageUrl": "https://exemplo.com/imagem.jpg"
}
```

## Fluxo de Uso

1. **Criar instância**: `POST /admin/create-instance`
2. **Obter QR Code**: `GET /qr/:secretCode`
3. **Escanear QR Code** com WhatsApp
4. **Enviar mensagens**: `POST /send` com o `secret_code`

## Estrutura de Arquivos

- `server.js` - Servidor principal
- `conn.js` - Gerenciamento de conexões WhatsApp
- `utils/fileStorage.js` - Persistência em JSON
- `routes/admin.js` - Endpoints administrativos
- `routes/qr.js` - Endpoints de QR Code
- `routes/send.js` - Endpoints de envio
- `connections.json` - Banco de dados das conexões
- `auth/` - Pasta com credenciais de cada instância

## Docker

```bash
docker build -t whatsapp-bot .
docker run -p 3335:3335 -v $(pwd)/auth:/app/auth -v $(pwd)/connections.json:/app/connections.json whatsapp-bot
```