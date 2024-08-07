const axios = require("axios").default;
const ioClient = require("socket.io-client");

const clients = {};

let players = {};
let unmatched;

// Function to handle socket connection
const connectToSocket = (io) => {
  io.on("connection", async (socket) => {
    console.log("SOCKET", socket);
    const id = socket.id;
    const url = socket.handshake.query.urlHost;
    const idOtherServer = socket.handshake.query.id;

    console.log("New client connected. ID:", id);

    // Add new client to the clients object
    clients[socket.id] = socket;
    console.log("ID OTHER SERVER", idOtherServer);

    // Handle client disconnect event
    socket.on("disconnect", () => {
      console.log("Client disconnected. ID:", socket.id);
      delete clients[socket.id];
      socket.broadcast.emit("clientdisconnect", id);
    });

    // Join the room and check if the user is on another server
    // joinRoom(socket);
    console.log(isUserOnOtherServer(socket));

    // If opponent is on another server or URL is not localhost:7071


    socket.on("start.game", () => {
      console.log("start game!", socket.id);
      joinRoom(socket);
      if(players[socket.id]) {
        if (
          (opponentOf(socket) && isUserOnOtherServer(opponentOf(socket))) ||
          (unmatched && url !== "localhost:7071")
        ) {
          // Connect to the second API
          const secondAPI = ioClient(process.env.SOCKET_TWO_URL, {
            query: { id: id, urlHost: "localhost:7070" },
          });
    
          // Notify both players that the game begins
          if (opponentOf(socket)) {
            socket.emit("game.begin", { symbol: players[socket.id].symbol });
            console.log("Game begins!!");
            opponentOf(socket).emit("game.begin", { symbol: players[opponentOf(socket).id].symbol });
          }
    
          // Handle move made by a player
          socket.on("make.move", (data) => {
            console.log(data);
            if (!opponentOf(socket)) return;
    
            // Forward move to the second API
            secondAPI.emit("make.move", data);
    
            // Check if the game is over
            if (isGameOver(data.board)) {
              console.log("hey");
              socket.emit("game.end", { winMessage: "You won!" });
              opponentOf(socket).emit("game.end", { winMessage: "You lost!" });
            }
            // Notify both players about the move
            socket.emit("move.made", data);
            opponentOf(socket).emit("move.made", data);
          });
    
          // Handle client disconnect
          socket.on("disconnect", () => {
            if (opponentOf(socket)) {
              opponentOf(socket).emit("opponent.left");
              secondAPI.emit("opponent.left");
            }
          });
          console.log(url);
        } else {
          // Notify both players that the game begins
          if (opponentOf(socket)) {
            socket.emit("game.begin", { symbol: players[socket.id].symbol });
            console.log("Game begins!!");
            opponentOf(socket).emit("game.begin", { symbol: players[opponentOf(socket).id].symbol });
          }
    
          // Handle move made by a player
          socket.on("make.move", (data) => {
            console.log(data);
            if (!opponentOf(socket)) return;
    
            // Check if the game is over
            if (isGameOver(data.board)) {
              console.log("hey");
              socket.emit("game.end", { winMessage: "You won!" });
              opponentOf(socket).emit("game.end", { winMessage: "You lost!" });
            }
            // Notify both players about the move
            socket.emit("move.made", data);
            opponentOf(socket).emit("move.made", data);
          });
    
          // Handle game reset
          socket.on("reset.game", () => {
            if (!opponentOf(socket)) return;
    
            socket.emit("game.reseted", { myTurn: true });
            opponentOf(socket).emit("game.reseted", { myTurn: false });
          });
    
          // Handle client disconnect
          socket.on("disconnect", () => {
            if (opponentOf(socket)) {
              opponentOf(socket).emit("opponent.left");
            }
          });
        }
      }
    })
  });
};

// Function to handle joining a room
const joinRoom = (socket) => {
  console.log("room joined", socket.id);
  players[socket.id] = {
    opponent: unmatched,
    symbol: "X",
    socket: socket,
  };
  console.log("PLAYERS", players);

  // Assign symbol and opponent
  if (unmatched) {
    console.log('unmatch present', unmatched)
    players[socket.id].symbol = "O";
    players[unmatched].opponent = socket.id;
    console.log('players after unmatch', players)
    // console.log(players)
    unmatched = undefined;
  } else {
    unmatched = socket.id;
  }
};

const joinRoomOtherServer = (socket) => {
  console.log(
    "JOINED ROOM FROM OTHER SERVER",
    socket,
    "JOINED ROOM FROM OTHER SERVER"
  );
  players[socket.id] = {
    opponent: socket.opponent,
    symbol: socket.symbol,
  };

  if (unmatched) {
    players[socket.id].symbol = "O";
    players[unmatched].opponent = socket.id;
    unmatched = null;
  } else {
    unmatched = socket.id;
  }
  console.log("PLYAERS 2", players);
  return players[socket.id];
};

const isUserOnOtherServer = (socket) => {
  if (socket.handshake.query.id) {
    return true;
  } else {
    return false;
  }
};

const opponentOf = (socket) => {
  if (!players[socket.id].opponent) {
    return;
  }
  return players[players[socket.id].opponent].socket;
};

const getOpponentObject = (id) => {
  return players[players[id].opponent];
};

const getOpponentId = (id) => {
  console.log(" ID", id, " ID");
  console.log("OPPONENT ID", players[id].opponent, "OPPONENT ID");
  return players[id].opponent;
};

const isGameOver = (board) => {
  console.log("game over is true board", board);
  let matches = ["XXX", "OOO"];
  let rows = [
    board.r0c0 + board.r0c1 + board.r0c2, // 1st line
    board.r1c0 + board.r1c1 + board.r1c2, // 2nd line
    board.r2c0 + board.r2c1 + board.r2c2, // 3rd line
    board.r0c0 + board.r1c0 + board.r2c0, // 1st column
    board.r0c1 + board.r1c1 + board.r2c1, // 2nd column
    board.r0c2 + board.r1c2 + board.r2c2, // 3rd column
    board.r0c0 + board.r1c1 + board.r2c2, // Primary diagonal
    board.r0c2 + board.r1c1 + board.r2c0, // Secondary diagonal
  ];

  for (let i = 0; i < rows.length; i++) {
    if (rows[i] === matches[0] || rows[i] === matches[1]) {
      console.log("game over is true rows", rows[i]);
      return true;
    }
  }

  return false;
};

const getUnmatched = () => {
  return unmatched;
};

module.exports = {
  connectToSocket,
  players,
  unmatched,
  joinRoom,
  getUnmatched,
  joinRoomOtherServer,
  getOpponentObject,
  getOpponentId,
};
