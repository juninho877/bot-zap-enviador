const express = require("express");
const startSock = require("./conn");
const sendRoute = require("./routes/send");

const app = express();
const PORT = process.env.PORT || 3334;

app.use(express.json());

startSock().then((sock) => {
  app.use("/", sendRoute(sock));
  app.listen(PORT, () => {
    console.log(`📡 API rodando em http://localhost:${PORT}`);
  });
});
