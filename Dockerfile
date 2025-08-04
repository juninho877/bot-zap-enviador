FROM node:20

WORKDIR /app

# Instala git para poder baixar dependências via repositório git
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 3334

CMD ["node", "server.js"]
